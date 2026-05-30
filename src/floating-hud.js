import * as THREE from 'three';

/**
 * HolographicPanel Class
 * Renders an Iron Man-style 3D floating digital display next to the avatar.
 * Uses a CanvasTexture to display text and high-tech vector graphics dynamically.
 */
export class HolographicPanel {
  constructor(scene, camera, options = {}) {
    this.scene = scene;
    this.camera = camera;
    
    // Configurable parameters
    this.width = options.width || 1.3;
    this.height = options.height || 0.9;
    this.canvasWidth = options.canvasWidth || 512;
    this.canvasHeight = options.canvasHeight || 384;
    
    // Animation states
    this.isVisible = false;
    this.scale = 0.001;
    this.opacity = 0.0;
    this.targetScale = 0.001;
    this.targetOpacity = 0.0;
    
    // Position offsets (relative to avatar)
    this.offset = new THREE.Vector3(1.1, 0.2, -0.2); // Floating on the right side
    this.basePosition = new THREE.Vector3();
    
    // Create the canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    this.ctx = this.canvas.getContext('2d');
    
    // Create Three.js resources
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    
    this.geometry = new THREE.PlaneGeometry(this.width, this.height);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.scale.setScalar(0.001);
    
    // Add to scene
    this.scene.add(this.mesh);
    this.lines = [];
    
    // Immersive Detail View State (VR optimization)
    this.isDetailView = false;
    this.activeDetailItem = null;
    this.savedTitle = 'SYNAPSE ARCHIVE';
    this.savedLines = [
      'INITIALIZING CONNECTION CORE...',
      'WAITING FOR DATAPACK SYNC...'
    ];
    this.rawItems = [];
    
    // Initial draw
    this.updateContent('SYNAPSE ARCHIVE', [
      'INITIALIZING CONNECTION CORE...',
      'WAITING FOR DATAPACK SYNC...'
    ]);
  }

  /**
   * Draw the cyberpunk holographic layout on the 2D canvas.
   */
  drawCanvas(title, lines) {
    const ctx = this.ctx;
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, w, h);
    
    // 1. Semi-transparent backing (glowing dark teal with blur feel)
    ctx.fillStyle = 'rgba(4, 9, 15, 0.75)';
    ctx.beginPath();
    this.roundRect(ctx, 10, 10, w - 20, h - 20, 16);
    ctx.fill();
    
    // 2. Neon cyan outer glowing borders
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0, 243, 255, 0.6)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    
    // Reset shadow for text drawing to avoid performance lag and fuzzy text
    ctx.shadowBlur = 0;
    
    // 3. Futuristic corner decorative brackets
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 3;
    const bracketSize = 25;
    
    // Top-left
    ctx.beginPath();
    ctx.moveTo(10, 10 + bracketSize);
    ctx.lineTo(10, 10);
    ctx.lineTo(10 + bracketSize, 10);
    ctx.stroke();
    
    // Top-right
    ctx.beginPath();
    ctx.moveTo(w - 10, 10 + bracketSize);
    ctx.lineTo(w - 10, 10);
    ctx.lineTo(w - 10 - bracketSize, 10);
    ctx.stroke();
    
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(10, h - 10 - bracketSize);
    ctx.lineTo(10, h - 10);
    ctx.lineTo(10 + bracketSize, h - 10);
    ctx.stroke();
    
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(w - 10, h - 10 - bracketSize);
    ctx.lineTo(w - 10, h - 10);
    ctx.lineTo(w - 10 - bracketSize, h - 10);
    ctx.stroke();
    
    // 4. Subtle tech details / grid dots in background
    ctx.fillStyle = 'rgba(0, 243, 255, 0.15)';
    for (let x = 30; x < w - 30; x += 40) {
      for (let y = 70; y < h - 30; y += 40) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
    
    // 5. Header Title Bar
    ctx.fillStyle = 'rgba(0, 243, 255, 0.12)';
    ctx.fillRect(20, 20, w - 40, 40);
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 20, w - 40, 40);
    
    // Glowing blinking status square
    const blink = Math.floor(Date.now() / 500) % 2 === 0;
    ctx.fillStyle = blink ? '#ff6c00' : 'rgba(255, 108, 0, 0.2)';
    ctx.fillRect(35, 33, 14, 14);
    
    // Title text
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 16px "Orbitron", monospace';
    ctx.letterSpacing = '3px';
    ctx.fillText(title.toUpperCase(), 62, 43);
    
    // Sub-badge in header
    ctx.fillStyle = '#00f3ff';
    ctx.font = 'bold 10px "Share Tech Mono", monospace';
    ctx.fillText('DEC_LINK: SECURE', w - 150, 42);
    
    // 6. Subtitle / Content lines drawing
    if (this.isDetailView && this.activeDetailItem) {
      // Draw Title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px "Inter", "Hiragino Kaku Gothic Pro", sans-serif';
      
      const cleanTitle = this.activeDetailItem.title.replace(/^\d+\.\s*/, '').trim();
      
      // Word wrap title if needed
      const maxTitleWidth = w - 60;
      let currentTitleText = '';
      let titleY = 95;
      let isFirstTitleChar = true;
      for (const char of cleanTitle) {
        let testText = currentTitleText + char;
        let metrics = ctx.measureText(testText);
        if (metrics.width > maxTitleWidth && !isFirstTitleChar) {
          ctx.fillText(currentTitleText, 30, titleY);
          currentTitleText = char;
          titleY += 20;
        } else {
          currentTitleText = testText;
        }
        isFirstTitleChar = false;
      }
      ctx.fillText(currentTitleText, 30, titleY);

      // Draw Separator line
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
      ctx.beginPath();
      ctx.moveTo(30, titleY + 12);
      ctx.lineTo(w - 30, titleY + 12);
      ctx.stroke();

      // Draw Summary paragraph with wrapping
      ctx.fillStyle = 'rgba(0, 243, 255, 0.85)';
      ctx.font = '12px "Inter", "Hiragino Kaku Gothic Pro", sans-serif';
      ctx.shadowColor = 'rgba(0, 243, 255, 0.3)';
      ctx.shadowBlur = 4;
      
      const summaryText = this.activeDetailItem.description || '概要データはありません。';
      const maxTextWidth = w - 60;
      let currentLine = '';
      let y = titleY + 36;
      let isFirstSummaryChar = true;
      for (const char of summaryText) {
        let testLine = currentLine + char;
        let metrics = ctx.measureText(testLine);
        if (metrics.width > maxTextWidth && !isFirstSummaryChar) {
          ctx.fillText(currentLine, 30, y);
          currentLine = char;
          y += 20;
        } else {
          currentLine = testLine;
        }
        isFirstSummaryChar = false;
      }
      ctx.fillText(currentLine, 30, y);
      ctx.shadowBlur = 0;

      // Draw bottom flat buttons
      // Button 1: [BACK TO FEED]
      ctx.fillStyle = 'rgba(0, 243, 255, 0.08)';
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(30, 310, 210, 42);
      ctx.strokeRect(30, 310, 210, 42);
      
      ctx.fillStyle = '#00f3ff';
      ctx.font = 'bold 12px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('<< BACK TO FEED', 135, 336);

      // Button 2: [OPEN FULL ARTICLE]
      ctx.fillStyle = 'rgba(255, 108, 0, 0.08)';
      ctx.strokeStyle = 'rgba(255, 108, 0, 0.35)';
      ctx.fillRect(270, 310, 210, 42);
      ctx.strokeRect(270, 310, 210, 42);
      
      ctx.fillStyle = '#ff6c00';
      ctx.fillText('OPEN FULL ARTICLE >>', 375, 336);
      
      // Reset text align for normal operations
      ctx.textAlign = 'left';
    } else if (this.rawItems && this.rawItems.length > 0) {
      // --- Cyber Triptych Spatial Grid Layout (Huge click targets, high-fidelity VR alignment) ---
      const items = this.rawItems.slice(0, 3);
      
      // Draw Box 1 (Left Column - Headline 1)
      if (items[0]) {
        this.drawInteractiveBox(ctx, 20, 80, 225, 280, '1. TOPICS', items[0].title, items[0].description, '#00f3ff');
      }
      
      // Draw Box 2 (Right Column Top - Headline 2)
      if (items[1]) {
        this.drawInteractiveBox(ctx, 265, 80, 225, 132, '2. FOCUS', items[1].title, null, '#00f3ff');
      }
      
      // Draw Box 3 (Right Column Bottom - Headline 3)
      if (items[2]) {
        this.drawInteractiveBox(ctx, 265, 228, 225, 132, '3. TREND', items[2].title, null, '#ff6c00'); // Orange accent for third box
      }
    } else {
      let startY = 95;
      lines.forEach((line, idx) => {
        // Draw small bullet notch
        ctx.fillStyle = '#00f3ff';
        ctx.fillRect(30, startY - 9, 6, 6);
        
        // Draw glowing text shadow
        ctx.shadowColor = 'rgba(0, 243, 255, 0.5)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#e2f5ff';
        
        // Japanese/English compatible font stack
        ctx.font = 'bold 15px "Inter", "Hiragino Kaku Gothic Pro", sans-serif';
        
        // Handle word wrapping if the line is too long
        const maxTextWidth = w - 75;
        let currentLineText = '';
        let testLineY = startY;
        let isFirstLineChar = true;
        
        for (const char of line) {
          const testText = currentLineText + char;
          const metrics = ctx.measureText(testText);
          if (metrics.width > maxTextWidth && !isFirstLineChar) {
            ctx.fillText(currentLineText, 48, testLineY);
            currentLineText = char;
            testLineY += 24;
          } else {
            currentLineText = testText;
          }
          isFirstLineChar = false;
        }
        ctx.fillText(currentLineText, 48, testLineY);
        
        // Update Y anchor for next line
        startY = testLineY + 36;
        ctx.shadowBlur = 0;
      });
    }
    
    // 7. Futuristic scrolling scanline simulation
    const scanlineY = (Date.now() * 0.1) % (h - 40) + 20;
    ctx.fillStyle = 'rgba(0, 243, 255, 0.06)';
    ctx.fillRect(20, scanlineY, w - 40, 2);
  }

  /**
   * Draws a gorgeous interactive dashboard box on the canvas.
   */
  drawInteractiveBox(ctx, x, y, w, h, badge, title, desc, accentColor) {
    // 1. Box background
    ctx.fillStyle = 'rgba(8, 14, 24, 0.7)';
    ctx.beginPath();
    this.roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    
    // 2. Cyberpunk border with accent color
    ctx.strokeStyle = accentColor + '33'; // 20% opacity
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Glowing corners
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    const cs = 12; // corner size
    
    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(x, y + cs);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cs, y);
    ctx.stroke();
    
    // Bottom-right corner
    ctx.beginPath();
    ctx.moveTo(x + w, y + h - cs);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w - cs, y + h);
    ctx.stroke();
    
    // 3. Mini header badge
    ctx.fillStyle = accentColor;
    ctx.font = '900 9px "Orbitron", monospace';
    ctx.letterSpacing = '1px';
    ctx.fillText(badge, x + 12, y + 20);
    
    // 4. Wrapped Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "Inter", "Hiragino Kaku Gothic Pro", sans-serif';
    
    const cleanTitle = title.replace(/^[【\[].*?[\]】]/g, '').trim(); // Strip brackets
    const maxTextWidth = w - 24;
    let currentLine = '';
    let lineY = y + 42;
    const maxLines = desc ? 4 : 3;
    let lineCount = 0;
    let isFirstBoxChar = true;
    
    for (const char of cleanTitle) {
      let testLine = currentLine + char;
      let metrics = ctx.measureText(testLine);
      if (metrics.width > maxTextWidth && !isFirstBoxChar) {
        ctx.fillText(currentLine, x + 12, lineY);
        currentLine = char;
        lineY += 18;
        lineCount++;
        if (lineCount >= maxLines - 1) {
          ctx.fillText(currentLine.substring(0, 8) + '...', x + 12, lineY);
          currentLine = '';
          break;
        }
      } else {
        currentLine = testLine;
      }
      isFirstBoxChar = false;
    }
    if (currentLine) {
      ctx.fillText(currentLine, x + 12, lineY);
    }
    
    // 5. Short Description (only for the large left column)
    if (desc) {
      ctx.fillStyle = 'rgba(0, 243, 255, 0.7)';
      ctx.font = '10px "Inter", "Hiragino Kaku Gothic Pro", sans-serif';
      
      const cleanDesc = desc.replace(/<[^>]*>/g, '').trim();
      let descLine = '';
      let descY = lineY + 28;
      let descLineCount = 0;
      let isFirstDescChar = true;
      
      for (const char of cleanDesc) {
        let testLine = descLine + char;
        let metrics = ctx.measureText(testLine);
        if (metrics.width > maxTextWidth && !isFirstDescChar) {
          ctx.fillText(descLine, x + 12, descY);
          descLine = char;
          descY += 15;
          descLineCount++;
          if (descLineCount >= 4) {
            ctx.fillText(descLine.substring(0, 12) + '...', x + 12, descY);
            descLine = '';
            break;
          }
        } else {
          descLine = testLine;
        }
        isFirstDescChar = false;
      }
      if (descLine) {
        ctx.fillText(descLine, x + 12, descY);
      }
    }
    
    // Reset letter spacing
    ctx.letterSpacing = '0px';
  }

  updateContent(title, lines) {
    if (!this.isDetailView) {
      this.savedTitle = title;
      this.savedLines = lines;
    }
    this.lines = lines;
    this.drawCanvas(title, lines);
    this.texture.needsUpdate = true;
  }

  showDetail(item) {
    this.isDetailView = true;
    this.activeDetailItem = item;
    this.updateContent('NEWS DETAILED VIEW', []);
  }

  showList() {
    this.isDetailView = false;
    this.activeDetailItem = null;
    this.updateContent(this.savedTitle, this.savedLines);
  }

  /**
   * Helper function to draw rounded rectangles
   */
  roundRect(ctx, x, y, width, height, radius) {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  show() {
    this.isVisible = true;
    this.targetScale = 1.0;
    this.targetOpacity = 1.0;
  }

  hide() {
    this.isVisible = false;
    this.targetScale = 0.001;
    this.targetOpacity = 0.0;
  }

  /**
   * Positions the panel dynamically in front or next to the active avatar base position.
   */
  setPosition(avatarPos, isVR = false) {
    if (isVR) {
      // In VR, bring the screen slightly closer and angle it towards user at chest/eye level (1.15m Y offset)
      this.offset.set(0.85, 1.15, -0.9); 
    } else {
      // Standard desktop placement
      this.offset.set(1.1, 0.2, -0.2);
    }
    
    this.basePosition.copy(avatarPos).add(this.offset);
    this.mesh.position.copy(this.basePosition);
  }

  /**
   * Smoothly LERPs scale, opacity, bobs up/down, and billboards toward the camera.
   */
  update(time, delta, isVR = false) {
    // 1. Interpolate scale and material opacity for smooth transitions
    this.scale += (this.targetScale - this.scale) * 6 * delta;
    this.opacity += (this.targetOpacity - this.opacity) * 6 * delta;
    
    this.mesh.scale.set(this.scale, this.scale, this.scale);
    this.material.opacity = this.opacity;
    
    // Hide mesh completely if scale is absolute zero to improve draw call efficiency
    this.mesh.visible = (this.scale > 0.01);
    
    if (!this.mesh.visible) return;
    
    // 2. Cybersecurity futuristic organic floating bobbing (Disabled in VR for perfect pointer click stability!)
    const bob = isVR ? 0 : Math.sin(time * 1.6) * 0.04;
    this.mesh.position.y = this.basePosition.y + bob;
    
    // 3. Make panel rotate to face the active camera viewpoint (Billboarding)
    const camPos = new THREE.Vector3();
    this.camera.getWorldPosition(camPos);
    
    // Keep Y rotation only to make it rotate upright, preventing awkward head tilt alignment
    const targetVector = new THREE.Vector3(camPos.x, this.mesh.position.y, camPos.z);
    this.mesh.lookAt(targetVector);
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}

/**
 * TacticalRadar Class
 * Renders a gorgeous rotating neon dial on the left side of the avatar.
 * Enhances the overall visual depth and sci-fi aesthetic.
 */
export class TacticalRadar {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    
    this.group = new THREE.Group();
    
    // Construct futuristic glowing concentric rings
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.18,
      wireframe: true,
      blending: THREE.AdditiveBlending
    });
    
    // 1. Outer tactical ring
    const geom1 = new THREE.RingGeometry(0.35, 0.38, 32);
    this.mesh1 = new THREE.Mesh(geom1, ringMat);
    this.group.add(this.mesh1);
    
    // 2. Inner targeting ring with different divisions
    const geom2 = new THREE.RingGeometry(0.2, 0.22, 16);
    this.mesh2 = new THREE.Mesh(geom2, new THREE.MeshBasicMaterial({
      color: 0xff6c00, // Warning orange accent
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
      wireframe: true,
      blending: THREE.AdditiveBlending
    }));
    this.group.add(this.mesh2);
    
    // 3. Inner crosshair lines
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.3
    });
    
    const points = [];
    points.push(new THREE.Vector3(-0.4, 0, 0));
    points.push(new THREE.Vector3(0.4, 0, 0));
    points.push(new THREE.Vector3(0, -0.4, 0));
    points.push(new THREE.Vector3(0, 0.4, 0));
    
    const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
    this.lines = new THREE.LineSegments(lineGeom, lineMat);
    this.group.add(this.lines);
    
    // Position offset (floating on left side of Alpha)
    this.offset = new THREE.Vector3(-1.1, 0.25, -0.2);
    this.basePosition = new THREE.Vector3();
    
    // Start active visible state
    this.scene.add(this.group);
  }
  
  setPosition(avatarPos, isVR = false) {
    if (isVR) {
      // Float at chest/eye level in VR (1.15m Y offset)
      this.offset.set(-0.85, 1.15, -0.9);
    } else {
      this.offset.set(-1.1, 0.25, -0.2);
    }
    
    this.basePosition.copy(avatarPos).add(this.offset);
    this.group.position.copy(this.basePosition);
  }
  
  update(time, delta, isVR = false) {
    // 1. Slow, high-tech organic floating (Disabled in VR for perfect pointer click stability!)
    const bob = isVR ? 0 : Math.cos(time * 1.2) * 0.03;
    this.group.position.y = this.basePosition.y + bob;
    
    // 2. Rotate components in opposite directions
    this.mesh1.rotation.z = time * 0.25;
    this.mesh2.rotation.z = -time * 0.5;
    this.lines.rotation.z = time * 0.1;
    
    // 3. Billboard towards camera
    const camPos = new THREE.Vector3();
    this.camera.getWorldPosition(camPos);
    
    // Full 3D rotation lookAt since it's a graphical element
    this.group.lookAt(camPos);
  }
  
  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
}
