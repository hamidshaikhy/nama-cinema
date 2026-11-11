import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Hall } from '../data/halls';
import { filmCanvas } from '../lib/filmArt';
import { EYE_HEIGHT, mulberry32, type Layout } from '../lib/seating';

/** Where the 2D seat map sits on screen, in CSS pixels relative to the canvas. */
export interface MapRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const MAP_FOV = 16;
const FLY_IN_MS = 1450;
const FLY_OUT_MS = 950;
const MAX_YAW = MathUtils.degToRad(42);
const MAX_PITCH = MathUtils.degToRad(22);
const SELECTED_COLOR = '#35c9b8';
const UP = new Vector3(0, 1, 0);
const TOWARD_SCREEN = new Vector3(0, 0, -1);

interface Flight {
  from: number;
  to: number;
  start: number;
  duration: number;
  resolve: () => void;
}

/**
 * The 3D cinema hall. It has two resting poses: looking straight down so the
 * room lines up with the 2D seat map drawn over it, and sitting in a seat
 * looking at the screen. `progress` runs from 0 (map) to 1 (seat) and every
 * camera property is derived from it, so a flight is just an eased number.
 *
 * Nothing renders unless something changed: a frame is drawn per flight step,
 * per look-around drag and per resize, then the loop stops.
 */
export class HallScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(MAP_FOV, 1, 0.1, 500);
  private readonly ambient = new AmbientLight('#ffffff', 1);
  private readonly seats: InstancedMesh;
  private readonly people: InstancedMesh;
  private readonly marker: Mesh;
  private readonly seatMatrices: Matrix4[] = [];
  private readonly disposables: { dispose: () => void }[] = [];

  private width = 1;
  private height = 1;
  private raf = 0;
  private disposed = false;

  private progress = 0;
  private flight: Flight | null = null;
  private selected = -1;

  private readonly mapPos = new Vector3(0, 60, 8);
  private readonly mapQuat = new Quaternion();
  private readonly seatPos = new Vector3();
  private readonly seatQuat = new Quaternion();
  private readonly dive = new Vector3();
  private readonly approach = new Vector3();
  private seatFov = 60;
  private shiftX = 0;
  private shiftY = 0;

  private yaw = 0;
  private pitch = 0;
  private drag: { id: number; x: number; y: number } | null = null;

  /** Called the first time the visitor drags to look around from a seat. */
  onLook: (() => void) | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly hall: Hall,
    private readonly layout: Layout,
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor('#070304');

    const { bounds } = layout;
    const roomWidth = bounds.x1 - bounds.x0 + 2.6;
    const backZ = bounds.z1 + 1.2;
    const topRowY = (hall.rows - 1) * hall.rise;
    const ceiling = Math.max(hall.screen.bottom + hall.screen.height + 0.9, topRowY + 3.2);
    const screenY = hall.screen.bottom + hall.screen.height / 2;

    this.scene.add(this.ambient);
    const spill = new DirectionalLight(hall.film.glow, 2.4);
    spill.position.set(0, screenY + 1.5, -1);
    spill.target.position.set(0, topRowY * 0.5, (bounds.z0 + bounds.z1) / 2);
    this.scene.add(spill, spill.target);

    this.buildRoom(roomWidth, backZ, ceiling);
    this.buildScreen(screenY);
    this.buildLights(roomWidth, backZ);

    const seatGeometry = this.track(buildSeatGeometry());
    const seatMaterial = this.track(
      new MeshLambertMaterial({ color: hall.seatColor, vertexColors: true }),
    );
    this.seats = new InstancedMesh(seatGeometry, seatMaterial, layout.seats.length);
    const dummy = new Object3D();
    dummy.scale.set(...hall.seatScale);
    layout.seats.forEach((seat, i) => {
      dummy.position.set(seat.x, seat.y, seat.z);
      dummy.updateMatrix();
      this.seatMatrices.push(dummy.matrix.clone());
      this.seats.setMatrixAt(i, dummy.matrix);
    });
    this.scene.add(this.seats);

    this.marker = new Mesh(
      seatGeometry,
      this.track(
        new MeshLambertMaterial({
          color: SELECTED_COLOR,
          emissive: SELECTED_COLOR,
          emissiveIntensity: 0.55,
        }),
      ),
    );
    this.marker.scale.set(...hall.seatScale);
    this.marker.visible = false;
    this.scene.add(this.marker);

    this.people = new InstancedMesh(
      this.track(buildPersonGeometry()),
      this.track(new MeshLambertMaterial({ color: '#ffffff' })),
      layout.seats.length,
    );
    this.people.count = 0;
    this.scene.add(this.people);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);

    this.setSize(canvas.clientWidth || 1, canvas.clientHeight || 1);
    // Compile shaders now, while the visitor is still reading the seat map,
    // so the first flight does not stall on its opening frame.
    this.renderer.compile(this.scene, this.camera);
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    // Hold roughly the same horizontal field of view on every screen shape, so
    // a phone in portrait sees as much of the screen's width as a laptop does.
    const vertical = 2 * Math.atan(Math.tan(MathUtils.degToRad(33)) / this.camera.aspect);
    this.seatFov = MathUtils.clamp(MathUtils.radToDeg(vertical), 48, 94);
    this.requestRender();
  }

  /** Pixels to slide the picture so the screen clears the booking panel. */
  setShift(x: number, y: number): void {
    this.shiftX = x;
    this.shiftY = y;
    this.requestRender();
  }

  /** Seats (by index) that should show a person sitting in them. */
  setOccupied(indices: number[]): void {
    const random = mulberry32(indices.length * 31 + 5);
    const dummy = new Object3D();
    const color = new Color();
    indices.forEach((seatIndex, i) => {
      const seat = this.layout.seats[seatIndex];
      const size = 0.94 + random() * 0.12;
      dummy.position.set(seat.x, seat.y, seat.z);
      dummy.rotation.y = (random() - 0.5) * 0.3;
      dummy.scale.set(1, size, 1);
      dummy.updateMatrix();
      this.people.setMatrixAt(i, dummy.matrix);
      color.setHSL(random(), 0.1, 0.015 + random() * 0.025);
      this.people.setColorAt(i, color);
    });
    this.people.count = indices.length;
    this.people.instanceMatrix.needsUpdate = true;
    if (this.people.instanceColor) this.people.instanceColor.needsUpdate = true;
    this.requestRender();
  }

  /** Leaves the map and settles into a seat. Resolves when the camera has landed. */
  flyToSeat(index: number, map: MapRect, instant = false): Promise<void> {
    this.poseOverMap(map);
    this.poseInSeat(index);
    this.select(index);
    this.yaw = 0;
    this.pitch = 0;
    this.progress = 0;
    // Draw the opening frame right away: the DOM map starts fading in this same
    // tick and the room underneath has to already be in place.
    this.draw();
    return this.animate(1, instant ? 0 : FLY_IN_MS);
  }

  /** Lifts back out of the seat to the overhead view the map is drawn on. */
  flyToMap(map: MapRect, instant = false): Promise<void> {
    this.poseOverMap(map);
    // Start from wherever the visitor was looking, not the seat's default aim.
    this.seatQuat.copy(this.camera.quaternion);
    this.yaw = 0;
    this.pitch = 0;
    return this.animate(0, instant ? 0 : FLY_OUT_MS).then(() => this.select(-1));
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.flight?.resolve();
    this.flight = null;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.seats.dispose();
    this.people.dispose();
    this.disposables.forEach((item) => item.dispose());
    this.renderer.dispose();
  }

  // --- camera -------------------------------------------------------------

  /**
   * Places the overhead camera so each seat in the room lands on the matching
   * seat of the DOM map. The lens is long and the camera far away, which
   * flattens the rake of the rows enough for the two to line up.
   */
  private poseOverMap(map: MapRect): void {
    const { bounds } = this.layout;
    const pxPerMetre = map.width / (bounds.x1 - bounds.x0);
    const visibleMetres = this.height / pxPerMetre;
    const distance = visibleMetres / (2 * Math.tan(MathUtils.degToRad(MAP_FOV / 2)));
    const offX = map.left + map.width / 2 - this.width / 2;
    const offY = map.top + map.height / 2 - this.height / 2;
    const midY = ((this.hall.rows - 1) * this.hall.rise) / 2 + 0.6;
    this.mapPos.set(
      (bounds.x0 + bounds.x1) / 2 - offX / pxPerMetre,
      midY + distance,
      (bounds.z0 + bounds.z1) / 2 - offY / pxPerMetre,
    );
    const down = this.mapPos.clone().setY(this.mapPos.y - 1);
    this.mapQuat.setFromRotationMatrix(new Matrix4().lookAt(this.mapPos, down, TOWARD_SCREEN));
  }

  private poseInSeat(index: number): void {
    const seat = this.layout.seats[index];
    const { screen } = this.hall;
    this.seatPos.set(seat.x, seat.y + EYE_HEIGHT, seat.z + 0.02);
    // People turn most of the way toward the middle of the screen, not all of it.
    const screenY = screen.bottom + screen.height / 2;
    const aim = new Vector3(
      seat.x * 0.3,
      MathUtils.lerp(this.seatPos.y, screenY, 0.85),
      0,
    );
    this.seatQuat.setFromRotationMatrix(new Matrix4().lookAt(this.seatPos, aim, UP));
    // Flight path: drop straight down over the map first, then come in from
    // above and behind the seat so the last metres read as sitting down.
    this.dive.set(
      this.mapPos.x,
      this.seatPos.y + (this.mapPos.y - this.seatPos.y) * 0.1,
      this.mapPos.z,
    );
    this.approach.set(this.seatPos.x, this.seatPos.y + 2.4, this.seatPos.z + 1.6);
  }

  private applyCamera(): void {
    const p = this.progress;
    const q = 1 - p;
    this.camera.position
      .copy(this.mapPos)
      .multiplyScalar(q * q * q)
      .addScaledVector(this.dive, 3 * q * q * p)
      .addScaledVector(this.approach, 3 * q * p * p)
      .addScaledVector(this.seatPos, p * p * p);

    this.camera.quaternion.slerpQuaternions(
      this.mapQuat,
      this.seatQuat,
      // Keep looking down at the seats until the camera is under the roof, then lift to the screen.
      MathUtils.smootherstep(p, 0.52, 0.985),
    );
    if (p === 1 && (this.yaw !== 0 || this.pitch !== 0)) {
      const turn = new Quaternion().setFromAxisAngle(UP, this.yaw);
      const tilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), this.pitch);
      this.camera.quaternion.premultiply(turn).multiply(tilt);
    }

    this.camera.fov = MathUtils.lerp(MAP_FOV, this.seatFov, p * p);
    const shift = MathUtils.smoothstep(p, 0.35, 1);
    if (shift > 0 && (this.shiftX !== 0 || this.shiftY !== 0)) {
      this.camera.setViewOffset(
        this.width,
        this.height,
        this.shiftX * shift,
        this.shiftY * shift,
        this.width,
        this.height,
      );
    } else {
      this.camera.clearViewOffset();
    }
    this.camera.updateProjectionMatrix();

    // House lights: up over the map, down once you are in your seat.
    this.ambient.intensity = MathUtils.lerp(2.6, 0.5, MathUtils.smoothstep(p, 0.1, 0.95));
  }

  private animate(to: number, duration: number): Promise<void> {
    this.flight?.resolve();
    this.flight = null;
    if (duration <= 0 || this.disposed) {
      this.progress = to;
      this.draw();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.flight = { from: this.progress, to, start: -1, duration, resolve };
      this.requestRender();
    });
  }

  private requestRender(): void {
    if (this.raf || this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    this.raf = 0;
    const flight = this.flight;
    if (flight) {
      // Time starts on the first frame actually drawn, so a busy main thread
      // at the moment of the tap delays the flight instead of skipping into it.
      if (flight.start < 0) flight.start = now;
      const t = Math.min(1, (now - flight.start) / flight.duration);
      this.progress = flight.from + (flight.to - flight.from) * easeInOutCubic(t);
      if (t >= 1) {
        this.progress = flight.to;
        this.flight = null;
        flight.resolve();
      } else {
        this.requestRender();
      }
    }
    this.draw();
  };

  private draw(): void {
    if (this.disposed) return;
    this.applyCamera();
    this.renderer.render(this.scene, this.camera);
  }

  private select(index: number): void {
    if (this.selected >= 0) {
      this.seats.setMatrixAt(this.selected, this.seatMatrices[this.selected]);
    }
    this.selected = index;
    if (index >= 0) {
      // Swap the instanced seat for the glowing marker rather than stacking them.
      this.seats.setMatrixAt(index, new Matrix4().makeScale(0, 0, 0));
      const seat = this.layout.seats[index];
      this.marker.position.set(seat.x, seat.y, seat.z);
    }
    this.marker.visible = index >= 0;
    this.seats.instanceMatrix.needsUpdate = true;
  }

  // --- look around --------------------------------------------------------

  private onPointerDown = (event: PointerEvent): void => {
    if (this.progress !== 1 || this.flight) return;
    this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.canvas.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || drag.id !== event.pointerId) return;
    const radiansPerPixel = MathUtils.degToRad(this.camera.fov) / this.height;
    this.yaw = MathUtils.clamp(
      this.yaw + (event.clientX - drag.x) * radiansPerPixel,
      -MAX_YAW,
      MAX_YAW,
    );
    this.pitch = MathUtils.clamp(
      this.pitch + (event.clientY - drag.y) * radiansPerPixel,
      -MAX_PITCH,
      MAX_PITCH,
    );
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (this.onLook) {
      this.onLook();
      this.onLook = null;
    }
    this.requestRender();
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.drag?.id === event.pointerId) this.drag = null;
  };

  // --- scene --------------------------------------------------------------

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private buildRoom(roomWidth: number, backZ: number, ceiling: number): void {
    const { hall, layout } = this;
    const frontZ = -0.4;
    const depth = backZ - frontZ;
    const midZ = (backZ + frontZ) / 2;
    const wall = this.track(new MeshLambertMaterial({ color: hall.wallColor }));
    const floor = this.track(new MeshLambertMaterial({ color: hall.floorColor }));

    const add = (geometry: BufferGeometry, material: MeshLambertMaterial) => {
      const mesh = new Mesh(this.track(geometry), material);
      this.scene.add(mesh);
      return mesh;
    };

    // Walls and ceiling face inward only, so the overhead camera, which starts
    // far above the roof, looks straight through them.
    add(new PlaneGeometry(roomWidth, depth).rotateX(-Math.PI / 2), floor).position.set(0, 0, midZ);
    add(new PlaneGeometry(roomWidth, depth).rotateX(Math.PI / 2), wall).position.set(0, ceiling, midZ);
    add(new PlaneGeometry(depth, ceiling).rotateY(Math.PI / 2), wall).position.set(-roomWidth / 2, ceiling / 2, midZ);
    add(new PlaneGeometry(depth, ceiling).rotateY(-Math.PI / 2), wall).position.set(roomWidth / 2, ceiling / 2, midZ);
    add(new PlaneGeometry(roomWidth, ceiling).rotateY(Math.PI), wall).position.set(0, ceiling / 2, backZ);
    add(new PlaneGeometry(roomWidth, ceiling), wall).position.set(0, ceiling / 2, frontZ);

    // One step of the rake per row; the last one runs back to the wall.
    const steps: BufferGeometry[] = [];
    for (let row = 1; row < hall.rows; row++) {
      const z0 = layout.bounds.z0 + row * hall.rowPitch;
      const z1 = row === hall.rows - 1 ? backZ : z0 + hall.rowPitch;
      const height = row * hall.rise;
      steps.push(
        new BoxGeometry(roomWidth, height, z1 - z0).translate(0, height / 2, (z0 + z1) / 2),
      );
    }
    if (steps.length) {
      const merged = mergeGeometries(steps);
      steps.forEach((step) => step.dispose());
      const rake = this.track(
        new MeshLambertMaterial({ color: new Color(hall.floorColor).multiplyScalar(1.5) }),
      );
      add(merged, rake);
    }
  }

  private buildScreen(screenY: number): void {
    const { screen, film } = this.hall;
    const texture = this.track(
      new CanvasTexture(filmCanvas(film.art, 1280, screen.width / screen.height)),
    );
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    const picture = new Mesh(
      this.track(new PlaneGeometry(screen.width, screen.height)),
      this.track(new MeshBasicMaterial({ map: texture, toneMapped: false })),
    );
    picture.position.set(0, screenY, 0);
    this.scene.add(picture);

    // Light bleeding off the screen onto the wall behind it and the floor below.
    const glow = this.track(new CanvasTexture(radialCanvas()));
    const bleed = this.track(
      new MeshBasicMaterial({
        map: glow,
        color: film.glow,
        transparent: true,
        opacity: 0.4,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    const halo = new Mesh(
      this.track(new PlaneGeometry(screen.width * 1.7, screen.height * 2)),
      bleed,
    );
    halo.position.set(0, screenY, -0.2);
    const pool = new Mesh(
      this.track(new PlaneGeometry(screen.width * 1.4, 7).rotateX(-Math.PI / 2)),
      bleed,
    );
    pool.position.set(0, 0.02, 1.6);
    this.scene.add(halo, pool);
  }

  private buildLights(roomWidth: number, backZ: number): void {
    const { hall, layout } = this;
    const warm = this.track(new MeshBasicMaterial({ color: '#ffcf96' }));
    const dummy = new Object3D();

    // A strip of light on the nose of every aisle step.
    const stepCount = layout.aisles.length * (hall.rows - 1);
    if (stepCount > 0) {
      const strips = new InstancedMesh(
        this.track(new BoxGeometry(hall.aisle * 0.55, 0.02, 0.05)),
        warm,
        stepCount,
      );
      let i = 0;
      for (const x of layout.aisles) {
        for (let row = 1; row < hall.rows; row++) {
          dummy.position.set(x, row * hall.rise + 0.01, layout.bounds.z0 + row * hall.rowPitch + 0.04);
          dummy.updateMatrix();
          strips.setMatrixAt(i++, dummy.matrix);
        }
      }
      this.scene.add(strips);
      this.disposables.push(strips);
    }

    // Wall lamps down both sides, following the rake.
    const lampZs: number[] = [];
    for (let z = hall.firstRowZ + 0.6; z < backZ - 0.8; z += 2.6) lampZs.push(z);
    const lamps = new InstancedMesh(
      this.track(new BoxGeometry(0.05, 0.55, 0.14)),
      warm,
      lampZs.length * 2,
    );
    const wash = this.track(
      new MeshBasicMaterial({
        map: this.track(new CanvasTexture(radialCanvas())),
        color: '#ff9d52',
        transparent: true,
        opacity: 0.2,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    const washGeometry = this.track(new PlaneGeometry(2.4, 3));
    let n = 0;
    for (const z of lampZs) {
      const row = MathUtils.clamp((z - layout.bounds.z0) / hall.rowPitch, 0, hall.rows - 1);
      const y = Math.floor(row) * hall.rise + 2.3;
      for (const side of [-1, 1]) {
        dummy.position.set(side * (roomWidth / 2 - 0.04), y, z);
        dummy.updateMatrix();
        lamps.setMatrixAt(n++, dummy.matrix);
        const pool = new Mesh(washGeometry, wash);
        pool.position.set(side * (roomWidth / 2 - 0.02), y, z);
        pool.rotation.y = (-side * Math.PI) / 2;
        this.scene.add(pool);
      }
    }
    this.scene.add(lamps);
    this.disposables.push(lamps);
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Bakes a flat grey level into a geometry so one material can shade its parts differently. */
function shade(geometry: BufferGeometry, level: number): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const count = flat.attributes.position.count;
  flat.setAttribute('color', new BufferAttribute(new Float32Array(count * 3).fill(level), 3));
  return flat;
}

/** A cinema seat about half a metre wide, standing on the origin and facing -z. */
function buildSeatGeometry(): BufferGeometry {
  const parts = [
    shade(new RoundedBoxGeometry(0.5, 0.14, 0.48, 2, 0.05).translate(0, 0.43, -0.06), 1),
    shade(
      new RoundedBoxGeometry(0.5, 0.68, 0.12, 2, 0.05).rotateX(0.15).translate(0, 0.78, 0.21),
      0.9,
    ),
    shade(new BoxGeometry(0.06, 0.2, 0.44).translate(-0.28, 0.5, -0.04), 0.22),
    shade(new BoxGeometry(0.06, 0.2, 0.44).translate(0.28, 0.5, -0.04), 0.22),
    shade(new BoxGeometry(0.4, 0.36, 0.34).translate(0, 0.18, 0), 0.14),
  ];
  const merged = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return merged;
}

/** Head and shoulders of someone seated; all that shows above a seat back. */
function buildPersonGeometry(): BufferGeometry {
  const parts = [
    new SphereGeometry(0.1, 12, 9).translate(0, 1.08, 0.08),
    new SphereGeometry(0.21, 12, 8).scale(1, 0.6, 0.55).translate(0, 0.86, 0.12),
  ];
  const merged = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return merged;
}

function radialCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.28)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  return canvas;
}
