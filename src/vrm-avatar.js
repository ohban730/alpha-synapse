import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

// Joint pose configurations for various conversational emotions
const POSES = {
  idle: {
    leftUpperArm: { x: -0.1, y: 0.0, z: -1.35 },
    rightUpperArm: { x: -0.1, y: 0.0, z: 1.35 },
    leftLowerArm: { x: 0.25, y: 0.1, z: 0.0 },
    rightLowerArm: { x: 0.25, y: -0.1, z: 0.0 },
    leftHand: { x: 0.0, y: 0.0, z: 0.0 },
    rightHand: { x: 0.0, y: 0.0, z: 0.0 },
    spine: { x: 0.0, y: 0.0, z: 0.0 }
  },
  happy: {
    leftUpperArm: { x: -0.3, y: 0.15, z: -1.25 },
    rightUpperArm: { x: -0.3, y: -0.15, z: 1.25 },
    leftLowerArm: { x: 0.9, y: 0.4, z: 0.0 },
    rightLowerArm: { x: 0.9, y: -0.4, z: 0.0 },
    leftHand: { x: 0.1, y: 0.0, z: 0.0 },
    rightHand: { x: 0.1, y: 0.0, z: 0.0 },
    spine: { x: -0.05, y: 0.0, z: 0.0 }
  },
  angry: {
    leftUpperArm: { x: -0.25, y: 0.2, z: -1.15 },
    rightUpperArm: { x: -0.25, y: -0.2, z: 1.15 },
    leftLowerArm: { x: 1.2, y: 0.6, z: 0.2 },
    rightLowerArm: { x: 1.2, y: -0.6, z: -0.2 },
    leftHand: { x: 0.0, y: 0.0, z: 0.0 },
    rightHand: { x: 0.0, y: 0.0, z: 0.0 },
    spine: { x: 0.05, y: 0.0, z: 0.0 }
  },
  sad: {
    leftUpperArm: { x: -0.1, y: 0.1, z: -1.38 },
    rightUpperArm: { x: -0.1, y: -0.1, z: 1.38 },
    leftLowerArm: { x: 0.3, y: 0.2, z: 0.1 },
    rightLowerArm: { x: 0.3, y: -0.2, z: -0.1 },
    leftHand: { x: 0.0, y: 0.0, z: 0.0 },
    rightHand: { x: 0.0, y: 0.0, z: 0.0 },
    spine: { x: 0.08, y: 0.0, z: 0.0 }
  },
  relaxed: {
    leftUpperArm: { x: -0.15, y: -0.1, z: -1.32 },
    rightUpperArm: { x: -0.2, y: -0.2, z: 1.22 },
    leftLowerArm: { x: 0.3, y: 0.1, z: 0.0 },
    rightLowerArm: { x: 0.75, y: -0.4, z: 0.2 },
    leftHand: { x: 0.0, y: 0.0, z: 0.0 },
    rightHand: { x: 0.1, y: -0.2, z: 0.0 },
    spine: { x: 0.02, y: 0.05, z: -0.02 }
  },
  surprised: {
    leftUpperArm: { x: -0.4, y: 0.1, z: -1.18 },
    rightUpperArm: { x: -0.4, y: -0.1, z: 1.18 },
    leftLowerArm: { x: 0.8, y: 0.2, z: 0.1 },
    rightLowerArm: { x: 0.8, y: -0.2, z: -0.1 },
    leftHand: { x: 0.2, y: 0.0, z: 0.0 },
    rightHand: { x: 0.2, y: 0.0, z: 0.0 },
    spine: { x: 0.05, y: 0.0, z: 0.0 }
  },
  thinking: {
    leftUpperArm: { x: -0.1, y: 0.0, z: -1.35 },
    rightUpperArm: { x: -0.45, y: -0.2, z: 1.2 },
    leftLowerArm: { x: 0.25, y: 0.1, z: 0.0 },
    rightLowerArm: { x: 1.25, y: -0.4, z: 0.25 },
    leftHand: { x: 0.0, y: 0.0, z: 0.0 },
    rightHand: { x: 0.1, y: -0.1, z: 0.0 },
    spine: { x: 0.04, y: 0.02, z: -0.01 }
  },
  teasing: {
    leftUpperArm: { x: -0.15, y: -0.1, z: -1.32 },
    rightUpperArm: { x: -0.4, y: -0.3, z: 1.15 },
    leftLowerArm: { x: 0.3, y: 0.1, z: 0.0 },
    rightLowerArm: { x: 1.1, y: -0.5, z: 0.3 },
    leftHand: { x: 0.0, y: 0.0, z: 0.0 },
    rightHand: { x: 0.2, y: -0.1, z: 0.0 },
    spine: { x: 0.04, y: 0.08, z: -0.05 }
  },
  greeting: {
    leftUpperArm: { x: -0.3, y: 0.2, z: -1.2 },
    rightUpperArm: { x: -0.1, y: 0.0, z: 1.35 },
    leftLowerArm: { x: 1.0, y: 0.3, z: -0.1 },
    rightLowerArm: { x: 0.25, y: -0.1, z: 0.0 },
    leftHand: { x: 0.1, y: 0.0, z: 0.0 },
    rightHand: { x: 0.0, y: 0.0, z: 0.0 },
    spine: { x: -0.02, y: -0.02, z: 0.0 }
  }
};

/**
 * VRMAvatar Class
 * Manages the loading, rendering, animations (breathing, blinking, lookAt neck/head rotation, lip-sync, procedural posing)
 * of VRM 3D models and houses a backup holographic wireframe particle grid.
 */
export class VRMAvatar {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.currentVRM = null;
    this.loader = new GLTFLoader();
    
    // Register VRMLoaderPlugin to standard GLTFLoader
    this.loader.register((parser) => {
      return new VRMLoaderPlugin(parser);
    });

    // Hologram Placeholder Elements
    this.holoGroup = new THREE.Group();
    this.scene.add(this.holoGroup);
    this.createHologramPlaceholder();

    // Animation & Blend State Variables
    this.clock = new THREE.Clock();
    
    // Breathing parameters
    this.breathingSpeed = 2.0;
    this.breathingAmount = 0.015;

    // Blinking parameters
    this.blinkTimer = 0;
    this.blinkDuration = 0.15; // 150ms
    this.blinkInterval = 4.0; // Blink every 4 seconds average
    this.isBlinking = false;
    this.blinkTimeElapsed = 0;

    // Lip sync parameters
    this.lipSyncValue = 0;
    this.lipSyncTarget = 0;
    this.lipSyncActive = false;
    this.currentVowel = 'aa';

    // Mouse Tracking LookAt
    this.mousePosition = new THREE.Vector2(0, 0);
    this.targetLookAt = new THREE.Vector3(0, 1.4, 3.0); // Target position in 3D
    this.headNode = null;
    this.neckNode = null;
    this.spineNode = null;

    // Default rest-pose rotations to enable relative motion and prevent gimbal twist / backward-swinging bugs!
    this.defaultRotations = {
      leftUpperArm: new THREE.Quaternion(),
      rightUpperArm: new THREE.Quaternion(),
      leftLowerArm: new THREE.Quaternion(),
      rightLowerArm: new THREE.Quaternion(),
      leftHand: new THREE.Quaternion(),
      rightHand: new THREE.Quaternion(),
      spine: new THREE.Quaternion()
    };

    // Pose animation variables
    this.activePose = 'idle';
    this.leftUpperArm = null;
    this.rightUpperArm = null;
    this.leftLowerArm = null;
    this.rightLowerArm = null;
    this.leftHand = null;
    this.rightHand = null;

    // Setup mouse listener
    window.addEventListener('mousemove', (e) => {
      // Normalize mouse coordinates to [-1, 1]
      this.mousePosition.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mousePosition.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
  }

  /**
   * Create a stunning high-tech holographic humanoid placeholder when no VRM is loaded.
   */
  createHologramPlaceholder() {
    // 1. Holographic Floor Grid
    const gridHelper = new THREE.GridHelper(10, 20, 0x00f3ff, 0x005566);
    gridHelper.position.y = -0.8;
    gridHelper.material.opacity = 0.4;
    gridHelper.material.transparent = true;
    this.holoGroup.add(gridHelper);

    // 2. Glowing Holographic Particle Cloud (Mind network)
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      // Cylindrical distribution around avatar space
      const radius = 0.5 + Math.random() * 1.5;
      const theta = Math.random() * Math.PI * 2;
      const y = -0.8 + Math.random() * 2.5;

      positions[i] = radius * Math.cos(theta);
      positions[i + 1] = y;
      positions[i + 2] = radius * Math.sin(theta);

      // Cyan-glow colors
      colors[i] = 0.0;     // R
      colors[i + 1] = 0.95; // G (glowing cyan-teal)
      colors[i + 2] = 1.0;  // B
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Custom glowing point material
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(geometry, particleMaterial);
    this.holoGroup.add(particles);

    // 3. Procedural Hologram Wireframe Dummy (Representing Alpha's initializing mesh)
    const dummyMaterial = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending
    });

    // Create a stylized high-tech representation of a humanoid figure
    const headGeom = new THREE.IcosahedronGeometry(0.2, 1);
    const headMesh = new THREE.Mesh(headGeom, dummyMaterial);
    headMesh.position.y = 1.35;
    this.holoGroup.add(headMesh);

    const chestGeom = new THREE.CylinderGeometry(0.22, 0.12, 0.6, 5);
    const chestMesh = new THREE.Mesh(chestGeom, dummyMaterial);
    chestMesh.position.y = 0.85;
    this.holoGroup.add(chestMesh);

    const ringGeom = new THREE.RingGeometry(0.5, 0.55, 32);
    const ringMesh = new THREE.Mesh(ringGeom, new THREE.MeshBasicMaterial({
      color: 0xff6c00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3
    }));
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.85;
    this.holoGroup.add(ringMesh);

    // Add nested rings
    const ringGeom2 = new THREE.RingGeometry(0.3, 0.32, 32);
    const ringMesh2 = new THREE.Mesh(ringGeom2, new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4
    }));
    ringMesh2.rotation.x = Math.PI / 2;
    ringMesh2.position.y = 1.35;
    this.holoGroup.add(ringMesh2);

    this.holoGroup.position.set(0, -0.6, 0);
  }

  /**
   * Loads a VRM model from a local file array buffer.
   * @param {ArrayBuffer} arrayBuffer The loaded VRM file buffer.
   */
  async loadModel(arrayBuffer) {
    try {
      console.log('Loading VRM file data...');
      
      // Clear previous model if exists
      this.clearCurrentModel();

      // Parse the ArrayBuffer using GLTFLoader
      const gltf = await new Promise((resolve, reject) => {
        this.loader.parse(arrayBuffer, '', resolve, reject);
      });

      const vrm = gltf.userData.vrm;
      if (!vrm) {
        throw new Error('This file is not a valid VRM model.');
      }

      this.currentVRM = vrm;
      this.scene.add(vrm.scene);

      // Align model properly (usually feet at origin 0,0,0)
      vrm.scene.position.set(0, -1.4, 0);
      vrm.scene.rotation.y = 0.0; // Face the camera (+Z direction)

      // Hide the initial hologram placeholder group
      this.holoGroup.visible = false;

      // Extract crucial bone nodes for animation
      if (vrm.humanoid) {
        // VRM 1.0 uses getNormalizedBoneNode
        // VRM 0.x uses getRawBone or getBone
        const getBone = (name) => {
          if (typeof vrm.humanoid.getNormalizedBoneNode === 'function') {
            return vrm.humanoid.getNormalizedBoneNode(name);
          } else if (typeof vrm.humanoid.getRawBone === 'function') {
            return vrm.humanoid.getRawBone(name);
          } else if (typeof vrm.humanoid.getBoneNode === 'function') {
            return vrm.humanoid.getBoneNode(name);
          }
          return null;
        };

        this.headNode = getBone('head');
        this.neckNode = getBone('neck');
        this.spineNode = getBone('spine') || getBone('chest');

        // Extract limb bones for dynamic posing and gestures
        this.leftUpperArm = getBone('leftUpperArm');
        this.rightUpperArm = getBone('rightUpperArm');
        this.leftLowerArm = getBone('leftLowerArm');
        this.rightLowerArm = getBone('rightLowerArm');
        this.leftHand = getBone('leftHand');
        this.rightHand = getBone('rightHand');

        // Reset to standard T-pose before storing default rotations to prevent offset / backward arm bugs
        if (typeof vrm.humanoid.resetPose === 'function') {
          vrm.humanoid.resetPose();
        } else if (typeof vrm.humanoid.toResetPose === 'function') {
          vrm.humanoid.toResetPose();
        }

        // Store default rotations to enable relative motion and prevent gimbal twist / backward-swinging bugs!
        this.defaultRotations = {
          leftUpperArm: this.leftUpperArm ? this.leftUpperArm.quaternion.clone() : new THREE.Quaternion(),
          rightUpperArm: this.rightUpperArm ? this.rightUpperArm.quaternion.clone() : new THREE.Quaternion(),
          leftLowerArm: this.leftLowerArm ? this.leftLowerArm.quaternion.clone() : new THREE.Quaternion(),
          rightLowerArm: this.rightLowerArm ? this.rightLowerArm.quaternion.clone() : new THREE.Quaternion(),
          leftHand: this.leftHand ? this.leftHand.quaternion.clone() : new THREE.Quaternion(),
          rightHand: this.rightHand ? this.rightHand.quaternion.clone() : new THREE.Quaternion(),
          spine: this.spineNode ? this.spineNode.quaternion.clone() : new THREE.Quaternion()
        };
      }

      // Configure default VRM lookAt parameters
      if (vrm.lookAt) {
        // Stop default lookat target since we will rotate neck/eyes programmatically
        vrm.lookAt.autoUpdate = false;
      }

      console.log('VRM materialization successful:', vrm);
      return vrm;

    } catch (err) {
      console.error('Error materializing VRM:', err);
      // Restore hologram on failure
      this.holoGroup.visible = true;
      throw err;
    }
  }

  /**
   * Clear the active VRM model from scene.
   */
  clearCurrentModel() {
    if (this.currentVRM) {
      this.scene.remove(this.currentVRM.scene);
      // Clean up meshes and textures
      this.currentVRM.scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((m) => m.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      this.currentVRM = null;
      this.headNode = null;
      this.neckNode = null;
      this.spineNode = null;
      this.leftUpperArm = null;
      this.rightUpperArm = null;
      this.leftLowerArm = null;
      this.rightLowerArm = null;
      this.leftHand = null;
      this.rightHand = null;
      this.activePose = 'idle';
      
      // Reset default rotations
      this.defaultRotations = {
        leftUpperArm: new THREE.Quaternion(),
        rightUpperArm: new THREE.Quaternion(),
        leftLowerArm: new THREE.Quaternion(),
        rightLowerArm: new THREE.Quaternion(),
        leftHand: new THREE.Quaternion(),
        rightHand: new THREE.Quaternion(),
        spine: new THREE.Quaternion()
      };
      
      // Re-enable holo group
      this.holoGroup.visible = true;
    }
  }

  /**
   * Dynamically triggers custom expressions.
   * Supports both VRM 0.x (blendShapeProxy) and VRM 1.x (expressionManager).
   * @param {string} name Expression name (e.g. 'happy', 'blink', 'aa', 'relaxed')
   * @param {number} value Value between 0.0 and 1.0
   */
  setExpression(name, value) {
    if (!this.currentVRM) return;
    
    // Normalize expression name
    let expName = name.toLowerCase();
    
    const manager = this.currentVRM.expressionManager || this.currentVRM.blendShapeProxy;
    if (manager) {
      // Map common expression variations to handle VRM 0.0 vs 1.0 differences
      let targetName = expName;
      
      // List all existing keys in manager to check matches
      const availableKeys = manager.expressions ? 
        manager.expressions.map(e => e.expressionName) : 
        (manager._blendShapeGroups ? Object.keys(manager._blendShapeGroups) : []);
      
      // Try exact, lowercase, or map standard 0.x uppercase values
      const matchedKey = availableKeys.find(key => {
        const kLow = key.toLowerCase();
        return kLow === expName || 
               (expName === 'aa' && kLow === 'a') ||
               (expName === 'ih' && kLow === 'i') ||
               (expName === 'ou' && kLow === 'u') ||
               (expName === 'ee' && kLow === 'e') ||
               (expName === 'oh' && kLow === 'o') ||
               (expName === 'blink' && kLow === 'blink');
      });

      if (matchedKey) {
        manager.setValue(matchedKey, value);
      } else {
        // Fallback setting
        try {
          manager.setValue(name, value);
        } catch(e) {}
      }
    }
  }

  /**
   * Smoothly updates the mouth (lip sync) state.
   * Vowels: 'aa', 'ih', 'ou', 'ee', 'oh'.
   */
  updateLipSync(delta) {
    if (!this.currentVRM) return;

    if (this.lipSyncActive) {
      // Simple dynamic simulation (jaw oscillation representing speech)
      const time = this.clock.getElapsedTime();
      this.lipSyncTarget = 0.25 + Math.sin(time * 24) * 0.45;
    } else {
      this.lipSyncTarget = 0;
    }

    // Interpolate (LERP) current mouth shape to target
    this.lipSyncValue += (this.lipSyncTarget - this.lipSyncValue) * 15 * delta;
    this.lipSyncValue = Math.max(0, Math.min(1.0, this.lipSyncValue));

    // Clear vowels first
    const vowels = ['aa', 'ih', 'ou', 'ee', 'oh'];
    vowels.forEach(v => {
      this.setExpression(v, 0.0);
    });

    // Apply value to active vowel
    if (this.lipSyncValue > 0.01) {
      this.setExpression(this.currentVowel, this.lipSyncValue);
    }
  }

  /**
   * Set mouth target viseme.
   * @param {string} vowel 'aa', 'ih', 'ou', 'ee', 'oh'
   */
  setViseme(vowel) {
    if (['aa', 'ih', 'ou', 'ee', 'oh'].includes(vowel)) {
      this.currentVowel = vowel;
    }
  }

  /**
   * Toggle speech state for lip sync.
   * @param {boolean} active 
   */
  setSpeaking(active) {
    this.lipSyncActive = active;
  }

  /**
   * Updates blinking cycle.
   */
  updateBlinking(delta) {
    if (!this.currentVRM) return;

    this.blinkTimer += delta;

    if (!this.isBlinking) {
      // Determine if it's time to blink (based on random interval)
      if (this.blinkTimer >= this.blinkInterval) {
        this.isBlinking = true;
        this.blinkTimeElapsed = 0;
        this.blinkTimer = 0;
        // Schedule next random blink interval
        this.blinkInterval = 2.0 + Math.random() * 5.0;
      }
    } else {
      // Handle the blinking action
      this.blinkTimeElapsed += delta;
      let blinkWeight = 0;

      if (this.blinkTimeElapsed < this.blinkDuration / 2) {
        // Closing eyes
        blinkWeight = (this.blinkTimeElapsed / (this.blinkDuration / 2));
      } else if (this.blinkTimeElapsed < this.blinkDuration) {
        // Opening eyes
        blinkWeight = 1.0 - ((this.blinkTimeElapsed - (this.blinkDuration / 2)) / (this.blinkDuration / 2));
      } else {
        // Blink finished
        this.isBlinking = false;
        blinkWeight = 0;
      }

      this.setExpression('blink', blinkWeight);
    }
  }

  /**
   * Handles head turning / mouse tracking (LookAt).
   */
  updateLookAt(delta) {
    if (!this.currentVRM) return;

    let targetYaw = 0;
    let targetPitch = 0;

    if (this.renderer && this.renderer.xr.isPresenting) {
      // WebXR Headset tracking
      const headWorldPos = new THREE.Vector3();
      if (this.headNode) {
        this.headNode.getWorldPosition(headWorldPos);
      } else {
        headWorldPos.copy(this.currentVRM.scene.position).y += 1.4;
      }

      const cameraWorldPos = new THREE.Vector3();
      this.camera.getWorldPosition(cameraWorldPos);

      // Gaze vector from head to VR headset
      const toCamera = new THREE.Vector3().subVectors(cameraWorldPos, headWorldPos);
      
      // Calculate lookAt yaw relative to standard front facing (+Z direction)
      targetYaw = Math.atan2(toCamera.x, toCamera.z);

      // Calculate lookAt pitch (Inverted to look up when headset is higher)
      const horizontalDist = Math.sqrt(toCamera.x * toCamera.x + toCamera.z * toCamera.z);
      targetPitch = -Math.atan2(toCamera.y, horizontalDist);

      // Clamp rotations to keep natural limit (max 45 deg yaw, 30 deg pitch)
      const maxYaw = Math.PI / 4;
      const maxPitch = Math.PI / 6;
      targetYaw = Math.max(-maxYaw, Math.min(maxYaw, targetYaw));
      targetPitch = Math.max(-maxPitch, Math.min(maxPitch, targetPitch));
    } else {
      // Desktop mouse tracking (Inverted to look up when mouse is at the top)
      const maxRotationX = Math.PI / 8; // Max yaw left/right (approx 22 deg)
      const maxRotationY = Math.PI / 12; // Max pitch up/down (approx 15 deg)

      targetYaw = -this.mousePosition.x * maxRotationX;
      targetPitch = -this.mousePosition.y * maxRotationY;
    }

    // Smoothly LERP neck/head rotations to target
    if (this.headNode) {
      // Head bone takes 60% of the movement
      this.headNode.rotation.y += (targetYaw * 0.6 - this.headNode.rotation.y) * 4 * delta;
      this.headNode.rotation.x += (targetPitch * 0.6 - this.headNode.rotation.x) * 4 * delta;
    }

    if (this.neckNode) {
      // Neck bone takes 40% of the movement
      this.neckNode.rotation.y += (targetYaw * 0.4 - this.neckNode.rotation.y) * 4 * delta;
      this.neckNode.rotation.x += (targetPitch * 0.4 - this.neckNode.rotation.x) * 4 * delta;
    }
  }

  /**
   * Poses the body joints to active target emotion.
   */
  setPose(poseName) {
    if (poseName && Object.prototype.hasOwnProperty.call(POSES, poseName)) {
      this.activePose = poseName;
    } else {
      this.activePose = 'idle';
    }
  }

  /**
   * Smoothly interpolates the skeletal joints to target pose.
   * Overlays procedural speech arm swaying dynamically.
   */
  updatePose(delta) {
    if (!this.currentVRM) return;

    const currentPoseData = POSES[this.activePose] || POSES.idle;
    const lerpSpeed = 3.0; // Smooth joint LERP speed

    // Calculate dynamic speech gestures (wave motions) if speaking/lip-sync is active
    const speakOffsets = {
      leftUpperArm: { x: 0, y: 0, z: 0 },
      rightUpperArm: { x: 0, y: 0, z: 0 },
      leftLowerArm: { x: 0, y: 0, z: 0 },
      rightLowerArm: { x: 0, y: 0, z: 0 }
    };

    if (this.lipSyncActive) {
      const time = this.clock.getElapsedTime();
      // Human-like desynchronized and asymmetric arm swaying (different frequencies, phase offsets, mostly forward-backward and twisting)
      speakOffsets.leftUpperArm.x = Math.sin(time * 2.5) * 0.05;
      speakOffsets.leftUpperArm.y = Math.cos(time * 1.8) * 0.03;
      speakOffsets.leftUpperArm.z = Math.sin(time * 1.2) * 0.01;

      speakOffsets.rightUpperArm.x = Math.sin(time * 2.1 + 1.2) * 0.04;
      speakOffsets.rightUpperArm.y = Math.cos(time * 1.6 + 0.8) * 0.03;
      speakOffsets.rightUpperArm.z = Math.sin(time * 2.2) * 0.01;

      // Lower arm (elbow) fluid breathing swaying (out-of-phase with upper arm to look highly organic!)
      speakOffsets.leftLowerArm.x = Math.sin(time * 3.1 + 0.6) * 0.08;
      speakOffsets.leftLowerArm.y = Math.cos(time * 2.4) * 0.04;

      speakOffsets.rightLowerArm.x = Math.sin(time * 2.8 + 1.0) * 0.08;
      speakOffsets.rightLowerArm.y = Math.cos(time * 2.1) * 0.04;
    }

    const interpolateJoint = (node, defaultQuat, baseRot, offsetRot = { x: 0, y: 0, z: 0 }) => {
      if (!node || !baseRot || !defaultQuat) return;
      const targetEuler = new THREE.Euler(
        baseRot.x + (offsetRot.x || 0),
        baseRot.y + (offsetRot.y || 0),
        baseRot.z + (offsetRot.z || 0),
        'XYZ'
      );
      const poseRelativeQuat = new THREE.Quaternion().setFromEuler(targetEuler);
      const targetQuat = defaultQuat.clone().multiply(poseRelativeQuat);
      node.quaternion.slerp(targetQuat, lerpSpeed * delta);
    };

    interpolateJoint(this.leftUpperArm, this.defaultRotations.leftUpperArm, currentPoseData.leftUpperArm, speakOffsets.leftUpperArm);
    interpolateJoint(this.rightUpperArm, this.defaultRotations.rightUpperArm, currentPoseData.rightUpperArm, speakOffsets.rightUpperArm);
    interpolateJoint(this.leftLowerArm, this.defaultRotations.leftLowerArm, currentPoseData.leftLowerArm, speakOffsets.leftLowerArm);
    interpolateJoint(this.rightLowerArm, this.defaultRotations.rightLowerArm, currentPoseData.rightLowerArm, speakOffsets.rightLowerArm);
    interpolateJoint(this.leftHand, this.defaultRotations.leftHand, currentPoseData.leftHand);
    interpolateJoint(this.rightHand, this.defaultRotations.rightHand, currentPoseData.rightHand);
  }

  /**
   * Main update tick to animate the model inside render loop.
   * Called inside requestAnimationFrame.
   */
  update(delta) {
    // 1. If VRM is loaded, update all active avatar animations
    if (this.currentVRM) {
      const time = this.clock.getElapsedTime();

      // Breathing & Standing Sway Animation (Spine/Chest bone sinusoidal rotation blended with active pose)
      if (this.spineNode) {
        const baseSpine = (POSES[this.activePose] && POSES[this.activePose].spine) || { x: 0, y: 0, z: 0 };
        
        // 1. Slow, natural human-like standing sways (gentle left-to-right & twist)
        const swayY = Math.sin(time * 0.8) * 0.03; // Gentle twist yaw
        const swayZ = Math.cos(time * 0.6) * 0.02; // Gentle side-to-side roll
        
        // 2. Sinusoidal breathing oscillation (pitch rotation)
        const breathX = Math.sin(time * this.breathingSpeed) * this.breathingAmount;

        // 3. Smoothly LERP all three axes to targets relativistically based on default spine rest-pose rotation
        const targetEuler = new THREE.Euler(
          baseSpine.x + breathX,
          baseSpine.y + swayY,
          baseSpine.z + swayZ,
          'XYZ'
        );
        const poseRelativeQuat = new THREE.Quaternion().setFromEuler(targetEuler);
        const targetQuat = this.defaultRotations.spine.clone().multiply(poseRelativeQuat);
        this.spineNode.quaternion.slerp(targetQuat, 3.0 * delta);
      }

      // Smoothly animate skeletal limb postures
      this.updatePose(delta);

      // Blink Animation
      this.updateBlinking(delta);

      // Mouse/Headset tracking LookAt
      this.updateLookAt(delta);

      // Lip sync mouth movements
      this.updateLipSync(delta);

      // Update VRM internal components (physics, spring bones, lookAt updater)
      this.currentVRM.update(delta);

    } else {
      // 2. If no VRM loaded, spin and animate holographic placeholder
      const time = this.clock.getElapsedTime();
      
      // Rotate grid particles & lines slowly
      this.holoGroup.rotation.y = time * 0.15;
      
      // Make particles breathe slightly
      const particles = this.holoGroup.children[1];
      if (particles) {
        particles.rotation.y = -time * 0.08;
      }

      // Rotate high-tech rings in opposite directions
      const ring1 = this.holoGroup.children[3];
      if (ring1) {
        ring1.rotation.z = time * 0.4;
      }
      
      const ring2 = this.holoGroup.children[4];
      if (ring2) {
        ring2.rotation.z = -time * 0.8;
      }
    }
  }
}
