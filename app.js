
        
        class ThreeJSPlotter {
            constructor(appController) {
                this.app = appController;
                this.container = document.getElementById('plot-container');
                this.scene = new THREE.Scene();
                this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
                this.camera.up.set(0, 0, 1);
                this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
                this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                this.raycaster = new THREE.Raycaster();
                this.mouse = new THREE.Vector2();
                this.hudCanvas = null;
                this.hudContext = null;
                this.hudTexture = null;
                this.hudScene = new THREE.Scene();
                this.hudCamera = null;
                this.hudSprite = null;
                this.plotGroup = new THREE.Group();
                this.axesGroup = new THREE.Group();
                this.renderDirty = true;
                this.pathVisualizerGroup = new THREE.Group();
                this.clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
                this.init();
            }
        
            init() {
                this.renderer.localClippingEnabled = true;
                this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
                this.renderer.setPixelRatio(window.devicePixelRatio);
                this.container.appendChild(this.renderer.domElement);
                this.camera.position.set(-10, 0, 5);
                this.camera.lookAt(0, 0, 0);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.1;
                this.controls.minDistance = 0.5; 
                this.controls.maxDistance = 500; 
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
                this.scene.add(ambientLight);
                const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
                directionalLight.position.set(1, 1, 1);
                this.scene.add(directionalLight);
                this.scene.add(this.plotGroup);
                this.scene.add(this.axesGroup);
                this.scene.add(this.pathVisualizerGroup);
                this.controls.enableZoom = true;
                this.initHUD();
                window.addEventListener('resize', () => this.onResize());
                this.container.addEventListener('mousemove', (e) => this.onMouseMove(e), false);
                this.updateTheme();
                this.animate();
            }
        
            onResize() {
                const width = this.container.clientWidth;
                const height = this.container.clientHeight;
                this.camera.aspect = width / height;
                this.camera.updateProjectionMatrix();
                if (this.hudCamera) {
                    this.hudCamera.left = -width / 2;
                    this.hudCamera.right = width / 2;
                    this.hudCamera.top = height / 2;
                    this.hudCamera.bottom = -height / 2;
                    this.hudCamera.updateProjectionMatrix();
                    this.updateHUDPosition();
                }
                this.renderer.setSize(width, height);
                this.renderDirty = true;
            }
        
            initHUD() {
                const width = this.container.clientWidth;
                const height = this.container.clientHeight;
                this.hudCamera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 1, 10);
                this.hudCamera.position.z = 10;
                this.hudCanvas = document.createElement('canvas');
                this.hudCanvas.width = 300;
                this.hudCanvas.height = 24;
                this.hudContext = this.hudCanvas.getContext('2d');
                this.hudContext.font = "14px 'JetBrains Mono', monospace";
                this.hudContext.textAlign = 'left';
                this.hudContext.textBaseline = 'middle';
                this.hudTexture = new THREE.CanvasTexture(this.hudCanvas);
                const spriteMaterial = new THREE.SpriteMaterial({ map: this.hudTexture, transparent: true });
                this.hudSprite = new THREE.Sprite(spriteMaterial);
                this.hudSprite.scale.set(this.hudCanvas.width, this.hudCanvas.height, 1.0);
                this.hudScene.add(this.hudSprite);
                this.updateHUDText('Hover for coordinates...');
                this.updateHUDPosition();
            }
        
            updateHUDText(text) {
                if (!this.hudContext || !this.hudCanvas || !this.hudTexture) return;
                this.hudContext.clearRect(0, 0, this.hudCanvas.width, this.hudCanvas.height);
                this.hudContext.fillStyle = document.body.classList.contains('light-theme') ? "rgba(0,0,0,0.7)" : "rgba(255, 255, 255, 0.7)";
                this.hudContext.fillText(text, 5, this.hudCanvas.height / 2);
                this.hudTexture.needsUpdate = true;
                this.renderDirty = true;
            }
        
            updateHUDPosition() {
                if (!this.hudSprite || !this.hudCamera) return;
                const width = this.container.clientWidth;
                const height = this.container.clientHeight;
                const margin = 20;
                const posX = -width / 2 + this.hudSprite.scale.x / 2 + margin;
                const posY = -height / 2 + this.hudSprite.scale.y / 2 + margin;
                this.hudSprite.position.set(posX, posY, 1);
            }
        
            onMouseMove(event) {
                const rect = this.container.getBoundingClientRect();
                this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const visibleObjects = this.plotGroup.children.filter(c => c.visible);
                const intersects = this.raycaster.intersectObjects(visibleObjects, true);
                if (intersects.length > 0) {
                    const p = intersects[0].point;
                    this.app.updateCoords(`Point: (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`);
                } else {
                    this.app.updateCoords(null);
                }
            }
        
            animate() {
                requestAnimationFrame(() => this.animate());
                const controlsUpdated = this.controls.update();
                if (controlsUpdated || this.renderDirty) {
                    this.renderer.autoClear = false;
                    this.renderer.clear();
                    this.renderer.render(this.scene, this.camera);
                    this.renderer.clearDepth();
                    this.renderer.render(this.hudScene, this.hudCamera);
                    this.renderDirty = false;
                }
            }
        
            clearPlots() {
                while (this.plotGroup.children.length > 0) {
                    const obj = this.plotGroup.children[0];
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                        else {
                            if (obj.material.map) obj.material.map.dispose();
                            obj.material.dispose();
                        }
                    }
                    this.plotGroup.remove(obj);
                }
                this.clearAxes();
                this.clearPathVisualizers();
            }
        
            clearAxes() {
                while (this.axesGroup.children.length > 0) {
                    const axisObject = this.axesGroup.children[0];
                    if (axisObject.geometry) axisObject.geometry.dispose();
                    if (axisObject.material) {
                        if (axisObject.material.map) axisObject.material.map.dispose();
                        axisObject.material.dispose();
                    }
                    this.axesGroup.remove(axisObject);
                }
            }
        
            clearPathVisualizers() {
                while (this.pathVisualizerGroup.children.length > 0) {
                    const pathObject = this.pathVisualizerGroup.children[0];
                    if (pathObject.geometry) pathObject.geometry.dispose();
                    if (pathObject.material) pathObject.material.dispose();
                    this.pathVisualizerGroup.remove(pathObject);
                }
            }

            setGridBounds(newBounds) {
                // This is a simplified version of updateAxesAndGrid that uses specific bounds
                this.clearAxes();
            
                const bounds = newBounds; // Use the passed-in bounds
                if (!isFinite(bounds.min.x) || bounds.isEmpty()) {
                    // Fallback if bounds are invalid
                    bounds.set(new THREE.Vector3(-10, -10, -10), new THREE.Vector3(10, 10, 10));
                }
            
                const isLightTheme = document.body.classList.contains('light-theme');
                const gridColor = isLightTheme ? 0xCBD5E1 : 0x374151;
                const textColor = isLightTheme ? '#0f172a' : '#f1f5f9';
                const sizeVec = bounds.getSize(new THREE.Vector3());
            
                const grid = new THREE.GridHelper(30, 30, gridColor, gridColor);
                grid.rotation.x = Math.PI / 2;
                grid.scale.set(sizeVec.x / 30, sizeVec.y / 30, 1);
                grid.position.set(0, 0, 0);
                grid.material.opacity = 0.50;
                grid.material.transparent = true;
                this.axesGroup.add(grid);
            
                const axisConfig = [
                    { name: 'X', color: 0xaa4444, dir: new THREE.Vector3(1, 0, 0) },
                    { name: 'Y', color: 0x44aa44, dir: new THREE.Vector3(0, 1, 0) },
                    { name: 'Z', color: 0x4444aa, dir: new THREE.Vector3(0, 0, 1) }
                ];
            
                axisConfig.forEach(({ name, color, dir }) => {
                    const axisName = name.toLowerCase();
                    const material = new THREE.LineBasicMaterial({ color: color });
                    const lineStart = dir.clone().multiplyScalar(bounds.min[axisName]);
                    const lineEnd = dir.clone().multiplyScalar(bounds.max[axisName]);
                    const geometry = new THREE.BufferGeometry().setFromPoints([lineStart, lineEnd]);
                    const line = new THREE.Line(geometry, material);
                    this.axesGroup.add(line);
                    const labelPos = lineEnd.clone().multiplyScalar(1.1);
                    this.axesGroup.add(this.createLabel(name, labelPos, textColor, 48));
                    const ticks = this.calculateNiceTicks(bounds.min[axisName], bounds.max[axisName]);
                    ticks.forEach(tickVal => {
                        if (Math.abs(tickVal) < 1e-9) return;
                        const tickPos = dir.clone().multiplyScalar(tickVal);
                        const tickSize = sizeVec.length() * 0.01;
                        const orthoDir = name === 'Z' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
                        const tickGeom = new THREE.BufferGeometry().setFromPoints([
                            tickPos.clone().sub(orthoDir.clone().multiplyScalar(tickSize)),
                            tickPos.clone().add(orthoDir.clone().multiplyScalar(tickSize))
                        ]);
                        const tickLine = new THREE.LineSegments(tickGeom, material);
                        this.axesGroup.add(tickLine);
                        const labelOffset = orthoDir.clone().multiplyScalar(tickSize * 2.5);
                        const numLabel = this.createLabel(tickVal.toString(), tickPos.clone().add(labelOffset), textColor, 32);
                        this.axesGroup.add(numLabel);
                    });
                });
            
                this.renderDirty = true;
            }
        
            renderAllPlots() {
                this.plotGroup.children.forEach(child => {
                    const plotObject = this.app.getPlaygroundObjectByMesh(child);
                    if (plotObject) {
                        child.visible = plotObject.visible;
                    }
                });
                this.updateAxesAndGrid();
            }
        
            updateSinglePlot(obj, isWireframe) {
                let newMesh;
                switch (obj.type) {
                    case 'surface':
                    case 'parametric':
                        if (obj.lastData) newMesh = this.createSurfaceMesh(obj, isWireframe);
                        break;
                    case 'curve':
                        if (obj.lastData) newMesh = this.createCurveMesh(obj);
                        break;
                    case 'vector':
                        if (obj.lastData) newMesh = this.createVectorMesh(obj);
                        break;
                    case 'single-vector':
                        newMesh = this.createSingleVectorMesh(obj);
                        break;
                }
                if (newMesh) {
                    newMesh.userData.objectId = obj.id;
                    if (obj.threeMesh) {
                        if (obj.threeMesh.geometry) obj.threeMesh.geometry.dispose();
                        if (obj.threeMesh.material) {
                            if (Array.isArray(obj.threeMesh.material)) obj.threeMesh.material.forEach(m => m.dispose());
                            else {
                                if (obj.threeMesh.material.map) obj.threeMesh.material.map.dispose();
                                obj.threeMesh.material.dispose();
                            }
                        }
                        this.plotGroup.remove(obj.threeMesh);
                    }
                    obj.threeMesh = newMesh;
                    if (obj.visible) {
                        this.plotGroup.add(obj.threeMesh);
                    }
                }
                this.updateAxesAndGrid();
            }
        
            calculateObjectBounds(mesh) {
                const boundingBox = new THREE.Box3();
                if (!mesh) return boundingBox;
                if (mesh.type === 'ArrowHelper') {
                    boundingBox.expandByPoint(mesh.position);
                    const endPoint = new THREE.Vector3().fromBufferAttribute(mesh.line.geometry.attributes.position, 1);
                    endPoint.applyMatrix4(mesh.matrixWorld);
                    boundingBox.expandByPoint(endPoint);
                } else if (mesh.geometry) {
                    if (!mesh.geometry.boundingBox) {
                        mesh.geometry.computeBoundingBox();
                    }
                    if (mesh.geometry.boundingBox) {
                        const meshBBox = mesh.geometry.boundingBox.clone();
                        meshBBox.applyMatrix4(mesh.matrixWorld);
                        boundingBox.union(meshBBox);
                    }
                }
                return boundingBox;
            }
        
            createLabel(text, position, color, fontSize = 32, background = false) {
                const isLightTheme = document.body.classList.contains('light-theme');
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                const font = `bold ${fontSize}px Inter, sans-serif`;
                context.font = font;
                const metrics = context.measureText(text);
                const textWidth = metrics.width;
                canvas.width = textWidth + (fontSize * 0.2);
                canvas.height = fontSize + (fontSize * 0.2);
                context.font = font;
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                if (background) {
                    context.fillStyle = isLightTheme ? "rgba(241, 245, 249, 0.7)" : "rgba(21, 21, 36, 0.7)";
                    context.fillRect(0, 0, canvas.width, canvas.height);
                }
                context.fillStyle = color;
                context.fillText(text, canvas.width / 2, canvas.height / 2);
                const texture = new THREE.CanvasTexture(canvas);
                const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
                const sprite = new THREE.Sprite(material);
                sprite.position.copy(position);
                const scale = canvas.height / 128;
                sprite.scale.set(scale * (canvas.width / canvas.height), scale, 1);
                return sprite;
            }
        
            calculateNiceTicks(min, max, maxTicks = 8) {
                if (min === max) return [min];
                const range = max - min;
                if (range === 0) return [min];
                const tickSpacing = range / (maxTicks - 1);
                const exponent = Math.floor(Math.log10(tickSpacing));
                const powerOf10 = Math.pow(10, exponent);
                const niceFraction = [1, 2, 2.5, 5, 10].find(f => (powerOf10 * f) > tickSpacing) || 10;
                const niceTickSpacing = niceFraction * powerOf10;
                const startTick = Math.floor(min / niceTickSpacing) * niceTickSpacing;
                const ticks = [];
                for (let i = startTick; i <= max * 1.001; i += niceTickSpacing) {
                    ticks.push(parseFloat(i.toPrecision(15)));
                }
                return ticks;
            }
        
            updateAxesAndGrid() {
                if (this.app.isBatchUpdating) return;
                this.clearAxes();
                let bounds = new THREE.Box3(
                    new THREE.Vector3(-10, -10, -10),
                    new THREE.Vector3(10, 10, 10)
                );
                if (!isFinite(bounds.min.x) || !isFinite(bounds.max.x) || bounds.isEmpty()) {
                    bounds = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
                }
                const size = bounds.getSize(new THREE.Vector3());
                const padding = size.length() * 0.1;
                bounds.expandByScalar(padding > 0.1 ? padding : 0.5);
                this.app.updateSlicingSliderRange(bounds);
                const isLightTheme = document.body.classList.contains('light-theme');
                const gridColor = isLightTheme ? 0xCBD5E1 : 0x374151;
                const textColor = isLightTheme ? '#0f172a' : '#f1f5f9';
                const sizeVec = bounds.getSize(new THREE.Vector3());
                const center = bounds.getCenter(new THREE.Vector3());
                const grid = new THREE.GridHelper(30, 30, gridColor, gridColor);
                grid.rotation.x = Math.PI / 2;
                grid.scale.set(sizeVec.x / 30, sizeVec.y / 30, 1);
                grid.position.set(0,0,0);
                grid.material.opacity = 0.50;         
                grid.material.transparent = true;
                this.axesGroup.add(grid);
                const axisConfig = [{ name: 'X', color: 0xaa4444, dir: new THREE.Vector3(1, 0, 0) }, { name: 'Y', color: 0x44aa44, dir: new THREE.Vector3(0, 1, 0) }, { name: 'Z', color: 0x4444aa, dir: new THREE.Vector3(0, 0, 1) }];
                axisConfig.forEach(({ name, color, dir }) => {
                    const axisName = name.toLowerCase();
                    const material = new THREE.LineBasicMaterial({ color: color });
                    const lineStart = dir.clone().multiplyScalar(bounds.min[axisName]);
                    const lineEnd = dir.clone().multiplyScalar(bounds.max[axisName]);
                    const geometry = new THREE.BufferGeometry().setFromPoints([lineStart, lineEnd]);
                    const line = new THREE.Line(geometry, material);
                    this.axesGroup.add(line);
                    const labelPos = lineEnd.clone().multiplyScalar(1.1);
                    this.axesGroup.add(this.createLabel(name, labelPos, textColor, 48));
                    const ticks = this.calculateNiceTicks(bounds.min[axisName], bounds.max[axisName]);
                    ticks.forEach(tickVal => {
                        if (Math.abs(tickVal) < 1e-9) return;
                        const tickPos = dir.clone().multiplyScalar(tickVal);
                        const tickSize = size.length() * 0.01;
                        const orthoDir = name === 'Z' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
                        const tickGeom = new THREE.BufferGeometry().setFromPoints([tickPos.clone().sub(orthoDir.clone().multiplyScalar(tickSize)), tickPos.clone().add(orthoDir.clone().multiplyScalar(tickSize))]);
                        const tickLine = new THREE.LineSegments(tickGeom, material);
                        this.axesGroup.add(tickLine);
                        const labelOffset = orthoDir.clone().multiplyScalar(tickSize * 2.5);
                        const numLabel = this.createLabel(tickVal.toString(), tickPos.clone().add(labelOffset), textColor, 32);
                        this.axesGroup.add(numLabel);
                    });
                });
                this.renderDirty = true;
            }
        
            createColormapTexture(colormapName) {
                const gradient = this.app.colormaps[colormapName]?.gradient;
                if (!gradient) { return this.createColormapTexture('Viridis'); }
                const colors = gradient.match(/#[0-9a-f]{6}/ig).map(hex => new THREE.Color(hex));
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 1;
                const context = canvas.getContext('2d');
                const grad = context.createLinearGradient(0, 0, 256, 0);
                colors.forEach((color, index) => {
                    grad.addColorStop(index / (colors.length - 1), color.getStyle());
                });
                context.fillStyle = grad;
                context.fillRect(0, 0, 256, 1);
                return new THREE.CanvasTexture(canvas);
            }
        
            
            createSurfaceMesh(obj, isWireframe) {
                const { vertices, indices, values, zMin, zMax } = obj.lastData;
                if (!vertices || vertices.length === 0) return null;
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                geometry.setIndex(new THREE.BufferAttribute(indices, 1));
                geometry.computeVertexNormals();
                let material;
                if (obj.config.useShader) {
                    geometry.setAttribute('colorValue', new THREE.BufferAttribute(values, 1));
                    const texture = this.createColormapTexture(obj.colormap);
                    material = new THREE.ShaderMaterial({
                        uniforms: {
                            colormap: { value: texture },
                            zMin: { value: zMin },
                            zMax: { value: zMax },
                            opacity: { value: obj.config.opacity }
                        },
                        vertexShader: `
                            attribute float colorValue;
                            varying float vValue;
                            void main() {
                                vValue = colorValue;
                                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                            }`,
                        fragmentShader: `
                            uniform sampler2D colormap;
                            uniform float zMin;
                            uniform float zMax;
                            uniform float opacity;
                            varying float vValue;
                            void main() {
                                if (isnan(vValue)) discard;
                                float normalizedValue = (vValue - zMin) / (zMax - zMin);
                                vec4 color = texture2D(colormap, vec2(normalizedValue, 0.5));
                                color.a *= opacity;
                                gl_FragColor = color;
                            }`,
                        wireframe: isWireframe,
                        side: THREE.DoubleSide,
                        transparent: true,
                        clipping: true
                    });
                } else {
                    const colors = [];
                    const gradientString = this.app.colormaps[obj.colormap].gradient;
                    const gradientColors = gradientString.match(/#[0-9a-f]{6}/ig).map(hex => new THREE.Color(hex));
                    const getGradientColor = (val) => {
                        let normalized = (zMax > zMin) ? (val - zMin) / (zMax - zMin) : 0;
                        normalized = Math.max(0, Math.min(1, normalized));
                        const idx = normalized * (gradientColors.length - 1);
                        const startIndex = Math.floor(idx);
                        const endIndex = Math.min(startIndex + 1, gradientColors.length - 1);
                        const alpha = idx - startIndex;
                        return new THREE.Color().copy(gradientColors[startIndex]).lerp(gradientColors[endIndex], alpha);
                    };
                    for (let i = 0; i < values.length; i++) {
                        const val = values[i];
                        if (!isFinite(val)) {
                            colors.push(0, 0, 0);
                        } else {
                            const color = getGradientColor(val);
                            colors.push(color.r, color.g, color.b);
                        }
                    }
                    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
                    material = new THREE.MeshStandardMaterial({
                        vertexColors: true,
                        side: THREE.DoubleSide,
                        wireframe: isWireframe,
                        opacity: obj.config.opacity,
                        transparent: obj.config.opacity < 1.0,
                        clippingPlanes: [this.clipPlane]
                    });
                }
                return new THREE.Mesh(geometry, material);
            }

            clearPathVisualizers() {
                while (this.pathVisualizerGroup.children.length > 0) {
                   const pathObject = this.pathVisualizerGroup.children[0];
                   if (pathObject.geometry) pathObject.geometry.dispose();
                   if (pathObject.material) pathObject.material.dispose();
                   this.pathVisualizerGroup.remove(pathObject);
               }
           }
           
           updatePathVisualizer(objectId, waypoints) {
               let line = this.pathVisualizerGroup.getObjectByName(objectId);
               if (line) {
                   line.geometry.dispose();
                   this.pathVisualizerGroup.remove(line);
               }
           
               if (waypoints && waypoints.length > 1) {
                   const points = waypoints.map(wp => new THREE.Vector3(wp.x, wp.y, wp.z));
                   const geometry = new THREE.BufferGeometry().setFromPoints(points);
                   const material = new THREE.LineDashedMaterial({
                       color: 0xffffff,
                       linewidth: 1,
                       scale: 1,
                       dashSize: 0.5,
                       gapSize: 0.2,
                   });
                   line = new THREE.Line(geometry, material);
                   line.computeLineDistances();
                   line.name = objectId;
                   this.pathVisualizerGroup.add(line);
               }
           }
        
            
            
            createCurveMesh(obj) {
                const { vertices, values } = obj.lastData;
                if (!vertices || vertices.length === 0) return null;
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                const vertexColors = [];
                const tMin = obj.config.tMin;
                const tMax = obj.config.tMax;
                const gradientString = this.app.colormaps[obj.colormap].gradient;
                const gradientColors = gradientString.match(/#[0-9a-f]{6}/ig).map(hex => new THREE.Color(hex));
                const getGradientColor = (t) => {
                    const idx = t * (gradientColors.length - 1);
                    const startIndex = Math.floor(idx);
                    const endIndex = Math.min(startIndex + 1, gradientColors.length - 1);
                    const alpha = idx - startIndex;
                    return new THREE.Color().copy(gradientColors[startIndex]).lerp(gradientColors[endIndex], alpha);
                };
                for (let i = 0; i < values.length; i++) {
                    const tNormalized = (values[i] - tMin) / (tMax - tMin);
                    const color = getGradientColor(tNormalized);
                    vertexColors.push(color.r, color.g, color.b);
                }
                geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
                const material = new THREE.LineBasicMaterial({
                    vertexColors: true,
                    linewidth: 3,
                    transparent: true,
                    opacity: obj.config?.opacity ?? 1.0,
                    clippingPlanes: [this.clipPlane],
                    clipIntersection: false
                });
                return new THREE.Line(geometry, material);
            }
            
            
            createVectorMesh(obj) {
                const { vectors, minMag, maxMag } = obj.lastData;
                if (!vectors || vectors.length === 0) return null;
                const shaftGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.8, 8);
                shaftGeom.translate(0, 0.4, 0);
                const headGeom = new THREE.ConeGeometry(0.03, 0.2, 6);
                headGeom.translate(0, 0.9, 0);
                const arrowGeom = THREE.BufferGeometryUtils.mergeBufferGeometries([shaftGeom, headGeom]);
                const arrowMat = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: obj.config?.opacity ?? 1.0,
                    clippingPlanes: [this.clipPlane],
                    clipIntersection: false
                });
                const instancedMesh = new THREE.InstancedMesh(arrowGeom, arrowMat, vectors.length);
                const dummy = new THREE.Object3D();
                const color = new THREE.Color();
                vectors.forEach((vec, i) => {
                    dummy.position.set(vec.origin.x, vec.origin.y, vec.origin.z);
                    const dir = new THREE.Vector3(vec.components.x, vec.components.y, vec.components.z).normalize();
                    dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
                    const scale = obj.config.scale * (vec.mag / maxMag);
                    dummy.scale.set(1, scale, 1);
                    dummy.updateMatrix();
                    instancedMesh.setMatrixAt(i, dummy.matrix);
                    const normalizedMag = (maxMag > minMag) ? (vec.mag - minMag) / (maxMag - minMag) : 0;
                    color.setHSL(0.7 * (1 - normalizedMag), 1.0, 0.5);
                    instancedMesh.setColorAt(i, color);
                });
                return instancedMesh;
            }
        
            createSingleVectorMesh(obj) {
                const c = obj.config;
                const origin = new THREE.Vector3(c.ox, c.oy, c.oz);
                const dir = new THREE.Vector3(c.vx, c.vy, c.vz);
                const length = dir.length();
                if (length < 1e-6) return null;
                const visualScale = c.visualScale || 1.0;
                const headLength = Math.max(length * 0.1, 0.5) * visualScale;
                const headWidth = Math.max(length * 0.05, 0.25) * visualScale;
                const arrowHelper = new THREE.ArrowHelper(dir.normalize(), origin, length, c.color, headLength, headWidth);
                const opacity = obj.config?.opacity ?? 1.0;
                arrowHelper.line.material.transparent = true;
                arrowHelper.line.material.opacity = opacity;
                arrowHelper.line.material.clippingPlanes = [this.clipPlane];
                arrowHelper.line.material.clipIntersection = false;
                arrowHelper.cone.material.transparent = true;
                arrowHelper.cone.material.opacity = opacity;
                arrowHelper.cone.material.clippingPlanes = [this.clipPlane];
                arrowHelper.cone.material.clipIntersection = false;
                return arrowHelper;
            }
        
            updateClippingPlane(enabled, axis, position) {
                this.renderer.localClippingEnabled = enabled;
                let normal;
                if (axis === 'x') normal = new THREE.Vector3(-1, 0, 0);
                else if (axis === 'y') normal = new THREE.Vector3(0, -1, 0);
                else normal = new THREE.Vector3(0, 0, -1);
                this.clipPlane.normal = normal;
                this.clipPlane.constant = position;
                this.renderDirty = true;
            }
        
            updateTheme() {
                const isLightTheme = document.body.classList.contains('light-theme');
                if (isLightTheme) {
                    const canvasBg = getComputedStyle(document.body).getPropertyValue('--canvas-bg').trim();
                    let color;
                    if (canvasBg.startsWith('#')) {
                        color = new THREE.Color(canvasBg);
                    } else if (canvasBg.startsWith('rgb')) {
                        const rgb = canvasBg.match(/\d+/g).map(Number);
                        color = new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
                    } else {
                        color = new THREE.Color(0xf8fafc);
                    }
                    this.renderer.setClearColor(color, 1);
                } else {
                    this.renderer.setClearColor(0x111827, 1);
                }
                this.updateHUDText(this.hudSprite.material.map.image.getContext('2d').measureText(this.hudSprite.material.map.image.getContext('2d').font).actualBoundingBoxRight > 0 ? this.hudSprite.material.map.image.getContext('2d').measureText(this.hudSprite.material.map.image.getContext('2d').font).actualBoundingBoxRight > 0 ? this.hudSprite.material.map.image.getContext('2d').measureText(this.hudSprite.material.map.image.getContext('2d').font).actualBoundingBoxRight > 0 ? this.hudSprite.material.map.image.getContext('2d').measureText(this.hudSprite.material.map.image.getContext('2d').font).actualBoundingBoxRight > 0 ? 'Hover for coordinates...' : this.hudSprite.material.map.image.getContext('2d').measureText(this.hudSprite.material.map.image.getContext('2d').font).actualBoundingBoxRight > 0 ? 'Hover for coordinates...' : this.hudSprite.material.map.image.getContext('2d').measureText(this.hudSprite.material.map.image.getContext('2d').font).actualBoundingBoxRight > 0 ? 'Hover for coordinates...' : 'Hover for coordinates...' : 'Hover for coordinates...' : 'Hover for coordinates...' : 'Hover for coordinates...');
                this.updateAxesAndGrid();
            }
        
            toggleGrid(visible) {
                this.axesGroup.visible = visible;
                this.renderDirty = true;
            }
        
            exportPNG() {
                this.renderer.render(this.scene, this.camera);
                this.renderer.render(this.hudScene, this.hudCamera);
                const dataURL = this.renderer.domElement.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = dataURL;
                a.download = 'plotter-pro-export.png';
                a.click();
            }
        
            setCameraView(view) {
                this.controls.reset();
                this.app.stopAllAnimations();
                this.updateAxesAndGrid();
                let bounds = this.axesGroup.children.length > 0 ? new THREE.Box3().setFromObject(this.axesGroup) : new THREE.Box3(new THREE.Vector3(-10, -10, -10), new THREE.Vector3(10, 10, 10));
                const center = bounds.getCenter(new THREE.Vector3());
                const size = bounds.getSize(new THREE.Vector3()).length();
                const camPos = size > 0.1 ? size * 1.5 : 20;
                this.camera.position.set(center.x + camPos, center.y + camPos, center.z + camPos);
                this.camera.up.set(0, 0, 1);
                switch (view) {
                    case 'top': this.camera.position.set(center.x, center.y, center.z + camPos); break;
                    case 'front': this.camera.position.set(center.x, center.y - camPos, center.z); break;
                    case 'side': this.camera.position.set(center.x + camPos, center.y, center.z); break;
                    case 'reset':
                    default: this.camera.position.set(center.x - camPos * 0.7, center.y - camPos * 0.7, center.z + camPos * 0.7); break;
                }
                this.camera.lookAt(center);
                this.renderDirty = true;
            }
        }
        
        class AppController {
            constructor() {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => this.init());
                } else {
                    this.init();
                }
                this.currentTutorialStep = 0;
                this.tutorialIsActive = false;
                this.tutorialSteps = [
                    {
                        title: "Welcome to 6AxisAnimation!",
                        text: "Let's take a quick tour of the main features to get you started."
                    },
                    {
                        selector: '.mode-tab[data-mode="playground"]',
                        title: "The Playground",
                        text: "You are in Playground mode, a sandbox for creating and combining multiple 3D objects. Other modes focus on a single plot."
                    },
                    {
                        selector: '#add-object-btn',
                        title: "Add an Object",
                        text: "This is where you begin. Click here to add mathematical objects like surfaces, curves, and vectors to your scene."
                    },
                    {
                        selector: '.playground-object',
                        title: "The Object Card",
                        text: "Each object you add gets its own card. Here you can define its mathematical formula and configure its appearance."
                    },
                    {
                        selector: '.animation-tray-wrapper',
                        title: "The Animation Panel",
                        text: "This is the control center for all animations. When you have an animatable object, its controller will appear here. You can animate an object's shape (V-Mode), its movement (P-Mode), or use a simple physics simulation."
                    },
                    {
                        selector: '#plot-container',
                        title: "The 3D Viewport",
                        text: "Interact with your creation! Click and drag to rotate, scroll to zoom, and right-click and drag to pan the camera."
                    },
                    {
                        title: "You're All Set!",
                        text: "That's everything you need to know to get started. Enjoy creating!"
                    }
                ];
            }
        
            init() {
                this.plotter = new ThreeJSPlotter(this);
                this.currentMode = 'playground';
                this.plotQueue = [];
                this.isBatchUpdating = false;
                this.focusedObjectId = null;
                this.isPlotting = new Set();
                this.mathFields = {};
                this.activeMathFieldId = null;
                this.mathFieldHistory = {};
                this.mathFieldHistoryPointer = {};
                this.mathFieldChangeTimeout = null;
                this.playgroundObjects = [];
                this.modeStates = { playground: [], surface: [], parametric: [], curve: [] };
                
                this.colormaps = {
                    Plasma: { name: 'Plasma', gradient: 'linear-gradient(90deg, #0d0887, #a41e9a, #fca636, #f0f921)' },
                    Viridis: { name: 'Viridis', gradient: 'linear-gradient(90deg, #440154, #21918c, #fde725)' },
                    Jet: { name: 'Jet', gradient: 'linear-gradient(90deg, #000080, #00FFFF, #FFFF00, #FF0000, #800000)' },
                    Hot: { name: 'Hot', gradient: 'linear-gradient(90deg, #000000, #FF0000, #FFFF00, #FFFFFF)' },
                    Cool: { name: 'Cool', gradient: 'linear-gradient(90deg, #00ffff, #ff00ff)' },
                    Greys: { name: 'Greys', gradient: 'linear-gradient(90deg, #000000, #FFFFFF)' },
                    Reds: { name: 'Reds', gradient: 'linear-gradient(90deg, #fff5f0, #fee0d2, #fcbba1, #fc9272, #fb6a4a, #ef3b2c, #cb181d, #99000d)' },
                    Blues: { name: 'Blues', gradient: 'linear-gradient(90deg, #f7fbff, #deebf7, #c6dbef, #9ecae1, #6baed6, #4292c6, #2171b5, #084594)' },
                    Greens: { name: 'Greens', gradient: 'linear-gradient(90deg, #f7fcf5, #e5f5e0, #c7e9c0, #a1d99b, #74c476, #41ab5d, #238b45, #005a32)' },
                    Purples: { name: 'Purples', gradient: 'linear-gradient(90deg, #fcfbfd, #efedf5, #dadaeb, #bcbddc, #9e9ac8, #807dba, #6a51a3, #4a1486)' },
                    Oranges: { name: 'Oranges', gradient: 'linear-gradient(90deg, #fff5eb, #fee6ce, #fdd0a2, #fdae6b, #fd8d3c, #f16913, #d94801, #8c2d04)' },
                    Browns: { name: 'Browns', gradient: 'linear-gradient(90deg, #f6e8c3, #dfc27d, #bf812d, #8c510a, #543005)' },
                    Yellows: { name: 'Yellows', gradient: 'linear-gradient(90deg, #ffffd4, #fee391, #fec44f, #fe9929, #d95f0e, #993404)' },
                    Cividis: { name: 'Cividis', gradient: 'linear-gradient(90deg, #00224e, #537e86, #f9e671)' },
                    Electric: { name: 'Electric', gradient: 'linear-gradient(90deg, #000000, #31052e, #890976, #e336a3, #f8c8dd, #ffffff)' },
                    Blackbody: { name: 'Blackbody', gradient: 'linear-gradient(90deg, #000000, #b22222, #ffcc00, #ffffff)' }
                };
            
                this.Easing = {
                    linear: t => t,
                    easeInQuad: t => t*t,
                    easeOutQuad: t => t*(2-t),
                    easeInOutQuad: t => t < 0.5 ? 2*t*t : -1 + (4-2*t)*t,
                };
            
                this.globalAnimationFrameId = null;
                this.globalLastTimestamp = 0;
                this.animationPerformancePresets = {
                    smooth:   { name: 'Smooth',   qualityFactor: 0.3,  throttle: 100  },
                    balanced: { name: 'Balanced', qualityFactor: 0.5,  throttle: 200 },
                    detailed: { name: 'Detailed', qualityFactor: 0.75, throttle: 300 },
                    ultra:    { name: 'Ultra',    qualityFactor: 1.0,  throttle: 400 }
                };
                this.currentAnimationPerformance = 'smooth';
                
                this.initializeElements();
                this.initializeCalculator();
                this.initializePresets();
                this.initializeWorker();
                this.setupEventListeners();
                this.setupIconToggles();
                this.initAccordions();
                this.expressionCache = {};
                this.FIXED_TIMESTEP = 1 / 60;
                this.accumulator = 0;
               
                this.renderAllPlotsDebounced = this.debounce(() => this.plotter.renderAllPlots(), 50);
            
                // --- START: Preloading and Tutorial Logic ---
                const loadedFromUrl = this.loadStateFromURL();
                const hasLoadedInitialPreset = localStorage.getItem('initialPresetLoaded') === 'true';
                const tutorialCompleted = localStorage.getItem('plotterProTutorialCompleted') === 'true';
                if (!loadedFromUrl) {
                    // Always land in playground on direct loads without URL state
                    this.switchMode('playground', true);
                    // Load the Atom preset only once per browser
                    if (!hasLoadedInitialPreset) {
                        const atomPreset = this.playgroundPresets['Atom'];
                        if (atomPreset) {
                            this.loadPlaygroundPreset(atomPreset);
                        }
                        localStorage.setItem('initialPresetLoaded', 'true');
                    }
                    // Start tutorial if not completed yet, independent of preset
                    if (!tutorialCompleted) {
                        setTimeout(() => this.startTutorial(), 500);
                    }
                }
                // --- END: Preloading and Tutorial Logic ---
            
                this.renderGlobalAnimationTray();
            }
        
            initializeElements() {
                this.modeTabs = document.querySelectorAll('.mode-tab');
                this.singleModeControls = document.getElementById('single-mode-controls');
                this.playgroundControls = document.getElementById('playground-controls');
                this.playgroundObjectsContainer = document.getElementById('playground-objects-container');
                this.loadingOverlay = document.getElementById('loading-overlay');
                this.animationTray = document.getElementById('global-animation-tray');
                this.coordsStatus = document.getElementById('coords-status');
                this.coordsStatusText = document.getElementById('coords-status-text');
                this.toastEl = document.getElementById('toast');
                this.appGrid = document.querySelector('.app-grid');
                this.presetsAccordion = document.getElementById('presets-accordion');
                this.presetsTitle = document.getElementById('presets-title');
                this.globalPlayPauseBtn = document.getElementById('global-play-pause-btn');
                this.globalPlayIcon = document.getElementById('global-play-icon');
                this.globalPauseIcon = document.getElementById('global-pause-icon');
                this.slicingEnabledToggle = document.getElementById('slicing-enabled-toggle');

                this.bufferingOverlay = document.getElementById('buffering-overlay');
                this.bufferingText = document.getElementById('buffering-text');
            
                this.sliceAxisCheckboxes = document.querySelectorAll('.slicing-axis-toggle input[type="checkbox"]');
                this.slicePositionSliders = {
                    x: document.getElementById('slice-position-slider-x'),
                    y: document.getElementById('slice-position-slider-y'),
                    z: document.getElementById('slice-position-slider-z')
                };
                this.slicePositionValues = {
                    x: document.getElementById('slice-position-value-x'),
                    y: document.getElementById('slice-position-value-y'),
                    z: document.getElementById('slice-position-value-z')
                };
                
            }

            renderPlaygroundUI() {
                if (this.currentMode === 'playground') {
                    
                    const fragment = document.createDocumentFragment();
            
                    if (this.playgroundObjects.length === 0) {
                        const emptyState = document.createElement('div');
                        emptyState.className = "text-center text-text-muted p-8 border-2 border-dashed border-border-color rounded-lg";
                        emptyState.innerHTML = `<svg ...>...</svg><h3>Empty Playground</h3><p>Click "Add Object" to start plotting.</p>`; 
                        fragment.appendChild(emptyState);
                    } else {
                        this.playgroundObjects.forEach(obj => {
                            const div = document.createElement('div');
                            div.className = 'playground-object';
                            if(this.focusedObjectId === obj.id) div.classList.add('focused');
                            div.dataset.objectId = obj.id;
                            div.innerHTML = this.getPlaygroundObjectHTML(obj);
                            
                            this.initializeMathFields(div);
                            this.setupPlaygroundObjectListeners(div, obj);
                            fragment.appendChild(div);
                        });
                    }
                    
                    
                    this.playgroundObjectsContainer.innerHTML = '';
                    this.playgroundObjectsContainer.appendChild(fragment);
            
                } else {
                    
                    const container = this.singleModeControls.querySelector(`.${this.currentMode}-controls`);
                    if (!container) return;
                    container.innerHTML = '';
                    const obj = this.playgroundObjects[0];
                    if (obj) {
                        const div = document.createElement('div');
                        div.dataset.objectId = obj.id;
                        div.innerHTML = this.getPlaygroundObjectHTML(obj);
                        container.appendChild(div);
                        this.initializeMathFields(div);
                    }
                    this.renderAppearanceSettings();
                }
            }


            showInfoModal() {
                this.infoModalCurrentSlide = 1;
                document.getElementById('info-modal-overlay')?.classList.remove('hidden');
                this.updateInfoModalSlide();
            }
            
            hideInfoModal() {
                document.getElementById('info-modal-overlay')?.classList.add('hidden');
            }
            
            updateInfoModalSlide() {
                const slides = document.querySelectorAll('.info-slide');
                this.infoModalTotalSlides = slides.length;
            
                slides.forEach((slide, index) => {
                    slide.classList.toggle('active', (index + 1) === this.infoModalCurrentSlide);
                });
            
                document.getElementById('info-modal-counter').textContent = `${this.infoModalCurrentSlide} / ${this.infoModalTotalSlides}`;
                document.getElementById('info-modal-prev').style.visibility = (this.infoModalCurrentSlide === 1) ? 'hidden' : 'visible';
            
                const nextButton = document.getElementById('info-modal-next');
                if (this.infoModalCurrentSlide === this.infoModalTotalSlides) {
                    nextButton.textContent = 'Got it!';
                } else {
                    nextButton.textContent = 'Next';
                }
            }


            initAccordions() {
                document.querySelectorAll('.left-panel .accordion').forEach((acc, index) => {
                    const header = acc.querySelector('.accordion-header');
                    const content = acc.querySelector('.accordion-content');
                    if (!header || !content) return;
                    header.addEventListener('click', () => {
                        const isOpen = header.classList.toggle('open');
                        content.classList.toggle('open');
                        content.style.maxHeight = isOpen ? content.scrollHeight + 32 + "px" : '0px';
                    });
                });
            }

            initializeWorker() {
                this.worker = new Worker('worker.js');
                this.worker.onmessage = (e) => {
                    const { id } = e.data;
                    this.isPlotting.delete(id);

                    const obj = this.getPlaygroundObject(id);
                    if (!obj) return;

                    const card = document.querySelector(`[data-object-id="${id}"]`);
                    card?.classList.remove('is-plotting');
                    
                    if (e.data.status === 'error') {
                        this.showError(e.data.message, id);
                        this.stopAnimation(id);
                        return;
                    }

                    if (e.data.status === 'success') {
                        this.hideError(id);
                        obj.lastData = e.data.data;
                        this.plotter.updateSinglePlot(obj, document.getElementById('wireframe-toggle').checked);
                        this.applyAdvancedTransforms(obj);
                        this.processNextInQueue();
                    }
                };
            }

            initializeMathFields(container) {
                const MQ = MathQuill.getInterface(2);

                container.querySelectorAll('.math-input-field').forEach(span => {
                    if (span.classList.contains('mq-initialized')) return;
                    span.classList.add('mq-initialized');

                    const id = span.id;
                    const objectId = span.closest('[data-object-id]').dataset.objectId;
                    const debouncedPlot = this.debounce(() => this.plot(objectId), 400);

                    if (!this.mathFieldHistory[id]) {
                        this.mathFieldHistory[id] = [];
                        this.mathFieldHistoryPointer[id] = -1;
                    }

                    const mathField = MQ.MathField(span, {
                        spaceBehavesLikeTab: true,
                        handlers: {
                            edit: (mathField) => {
                                this.activeMathFieldId = id;
                                this.hideError(objectId);

                                const currentLatex = mathField.latex();
                                const history = this.mathFieldHistory[id];
                                let pointer = this.mathFieldHistoryPointer[id];

                                if (this.mathFieldChangeTimeout) {
                                    clearTimeout(this.mathFieldChangeTimeout);
                                }

                                this.mathFieldChangeTimeout = setTimeout(() => {
                                    if (history.length === 0 || history[pointer] !== currentLatex) {
                                        if (pointer < history.length - 1) {
                                            history.splice(pointer + 1);
                                        }
                                        history.push(currentLatex);
                                        this.mathFieldHistoryPointer[id] = history.length - 1;

                                        if (history.length > 100) {
                                            history.shift();
                                            this.mathFieldHistoryPointer[id]--;
                                        }
                                    }
                                }, 300);

                                debouncedPlot();
                            },
                            enter: () => this.plot(objectId)
                        }
                    });

                    if (this.mathFieldHistory[id].length === 0) {
                        this.mathFieldHistory[id].push('');
                        this.mathFieldHistoryPointer[id] = 0;
                    }

                    $(mathField.el()).on('focus', () => {
                        this.activeMathFieldId = id;
                    });

                    this.mathFields[id] = mathField;
                });
            }

            setupIconToggles() {
                document.querySelectorAll('.icon-toggle-btn').forEach(btn => {
                    const checkbox = btn.querySelector('input[type="checkbox"]');
                    if (!checkbox) return;
                    const clickHandler = () => btn.classList.toggle('active', checkbox.checked);
                    btn.addEventListener('click', clickHandler);
                    clickHandler();
                });
            }

            processNextInQueue() {
                if (this.plotQueue.length === 0) return; 
            
                
                const nextId = this.plotQueue.shift(); 
                const obj = this.getPlaygroundObject(nextId);
            
                if (obj) {
                    
                    const card = document.querySelector(`[data-object-id="${nextId}"]`);
                    card?.classList.add('is-plotting');
                    this.plot(nextId, {}, false, true); 
                }
            }

            handleUndoRedo(e, isRedo = false) {
                if (!this.activeMathFieldId || !this.mathFields[this.activeMathFieldId]) return;

                const history = this.mathFieldHistory[this.activeMathFieldId] || [];
                let pointer = this.mathFieldHistoryPointer[this.activeMathFieldId] || 0;
                const mathField = this.mathFields[this.activeMathFieldId];

                if (isRedo) {
                    if (pointer < history.length - 1) {
                        pointer++;
                        this.mathFieldHistoryPointer[this.activeMathFieldId] = pointer;
                        mathField.latex(history[pointer]);
                    }
                } else {
                    if (pointer > 0) {
                        pointer--;
                        this.mathFieldHistoryPointer[this.activeMathFieldId] = pointer;
                        mathField.latex(history[pointer]);
                    }
                }

                e.preventDefault();
                e.stopPropagation();

                const objectId = $(mathField.el()).closest('[data-object-id]').data('objectId');
                if (objectId) this.plot(objectId);
            }
 
            setupEventListeners() {
                const debouncedPlot = this.debounce((id) => this.plot(id), 400);

                document.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { this.handleUndoRedo(e, false); } 
                    else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { this.handleUndoRedo(e, true); }
                });

                this.modeTabs.forEach(tab => tab.addEventListener('click', () => this.switchMode(tab.dataset.mode)));
                
                this.globalPlayPauseBtn.addEventListener('click', () => this.toggleAllAnimations());
                document.getElementById('global-reset-btn').addEventListener('click', () => this.resetAllAnimationsAndInputs());

                const inputHandler = (e) => {
                    const target = e.target;
                    const objectContainer = target.closest('[data-object-id]');
                    if (!objectContainer) return;

                    const objectId = objectContainer.dataset.objectId;
                    const obj = this.getPlaygroundObject(objectId);
                    if (!obj) return;

                    const configKey = target.dataset.config;
                    if (configKey) {
                         const value = target.type === 'checkbox' ? target.checked : (target.type === 'number' || target.type === 'range' ? parseFloat(target.value) : (target.type === 'color' ? target.value : target.value));
                         obj.config[configKey] = value;
                         const valueSpan = target.parentElement.querySelector('.range-value-display');
                         if (valueSpan) valueSpan.textContent = parseFloat(target.value).toFixed(target.step && target.step.includes('.') ? 2 : 0);
                         debouncedPlot(objectId);
                    }
                };
                
                document.querySelector('.left-panel').addEventListener('input', inputHandler);

                document.getElementById('wireframe-toggle').addEventListener('change', () => this.plotter.renderAllPlots());
                document.getElementById('grid-toggle').addEventListener('change', (e) => this.plotter.toggleGrid(e.target.checked));
                document.getElementById('export-png').addEventListener('click', () => this.plotter.exportPNG());
                document.getElementById('export-stl').addEventListener('click', () => this.exportSTL());
                document.getElementById('export-gltf').addEventListener('click', () => this.exportGLTF());
                document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());
                document.getElementById('load-settings').addEventListener('change', (e) => this.loadSettings(e));
                document.getElementById('share-btn').addEventListener('click', () => this.shareState());

                
                const debouncedImplicitReplot = this.debounce(() => {
                    this.playgroundObjects.forEach(obj => {
                        if (obj.type === 'implicit' && obj.visible) {
                            this.plot(obj.id);
                        }
                    });
                }, 250);

                const handleSliceControlChange = () => {
                    const enabled = this.slicingEnabledToggle.checked;
                    const activeCheckboxes = Array.from(this.sliceAxisCheckboxes).filter(cb => cb.checked);

                    
                    
                    if (enabled && activeCheckboxes.length > 0) {
                        const primaryAxis = activeCheckboxes[0].value;
                        const position = parseFloat(this.slicePositionSliders[primaryAxis].value);
                        
                        this.plotter.updateClippingPlane(true, primaryAxis, position);
                    } else {
                        this.plotter.updateClippingPlane(false, 'x', 0);
                    }

                    
                    this.sliceAxisCheckboxes.forEach(checkbox => {
                        const label = checkbox.nextElementSibling;
                        if (label) {
                            label.classList.toggle('bg-primary', checkbox.checked);
                            label.classList.toggle('text-white', checkbox.checked);
                        }
                    });
                    
                    Object.keys(this.slicePositionSliders).forEach(axis => {
                        const slider = this.slicePositionSliders[axis];
                        const valueEl = this.slicePositionValues[axis];
                        if(slider && valueEl) {
                            valueEl.textContent = parseFloat(slider.value).toFixed(2);
                        }
                    });

                    
                    if (enabled) {
                        debouncedImplicitReplot();
                    }
                };

                this.slicingEnabledToggle.addEventListener('change', handleSliceControlChange);
                this.sliceAxisCheckboxes.forEach(cb => cb.addEventListener('change', handleSliceControlChange));
                Object.values(this.slicePositionSliders).forEach(slider => {
                    if (slider) slider.addEventListener('input', handleSliceControlChange);
                });

                
                handleSliceControlChange();
                

                ['reset', 'top', 'front', 'side'].forEach(id => {
                    const btn = document.getElementById(`cam-${id}`);
                    if (btn) btn.addEventListener('click', () => this.plotter.setCameraView(id));
                });

                const addObjectBtn = document.getElementById('add-object-btn');
                const addObjectMenu = document.getElementById('add-object-menu');
                if (addObjectBtn && addObjectMenu) {
                    addObjectBtn.addEventListener('click', (e) => { e.stopPropagation(); addObjectMenu.classList.toggle('show'); });
                    addObjectMenu.addEventListener('click', (e) => {
                        if (e.target.matches('.dropdown-item')) {
                            this.addPlaygroundObject(e.target.dataset.type);
                            addObjectMenu.classList.remove('show');
                        }
                    });
                }
                document.body.addEventListener('click', (e) => { if (addObjectMenu && !e.target.closest('#add-object-menu')) addObjectMenu.classList.remove('show') });

                document.getElementById('theme-toggle').addEventListener('click', () => { document.body.classList.toggle('light-theme'); this.plotter.updateTheme(); });
                document.getElementById('zen-mode-toggle').addEventListener('click', () => { this.appGrid.classList.toggle('zen-mode'); setTimeout(() => this.plotter.onResize(), 310); });
                document.getElementById('exit-zen-mode').addEventListener('click', () => { this.appGrid.classList.remove('zen-mode'); setTimeout(() => this.plotter.onResize(), 310); });
                document.getElementById('exit-fullscreen-mode').addEventListener('click', () => { this.appGrid.classList.remove('fullscreen-zen-mode'); setTimeout(() => this.plotter.onResize(), 310); });

                document.getElementById('fit-view-btn').addEventListener('click', () => this.fitViewToObjects());
                document.getElementById('info-btn')?.addEventListener('click', () => this.showInfoModal());
                document.getElementById('info-modal-close-btn')?.addEventListener('click', () => this.hideInfoModal());
                document.getElementById('global-select-all-btn')?.addEventListener('click', () => this.toggleAllOverrides());
                document.getElementById('info-modal-overlay')?.addEventListener('click', (e) => {
                    if (e.target.id === 'info-modal-overlay') {
                        this.hideInfoModal();
                    }
                });
                const leftPanel = document.querySelector('.left-panel');
                leftPanel.addEventListener('click', (e) => {
                    const calcTrigger = e.target.closest('.calc-trigger-btn');
                    if (calcTrigger) {
                        this.openCalculator(calcTrigger.dataset.fieldId, calcTrigger);
                        return;
                    }

                    const actionBtn = e.target.closest('.math-input-action-btn');
                    if(actionBtn) {
                        const fieldId = actionBtn.dataset.fieldId;
                        const mathField = this.mathFields[fieldId];
                        if(!mathField) return;
                        if(actionBtn.dataset.action === 'copy-latex') {
                            this.copyToClipboard(mathField.latex(), 'LaTeX copied!');
                        } else if (actionBtn.dataset.action === 'copy-mathjs') {
                            this.copyToClipboard(this.convertLatexToMathJs(mathField.latex()), 'MathJS expression copied!');
                        }
                    }
                });

                const forceFullscreenBtn = document.getElementById('force-fullscreen-btn');
                if (forceFullscreenBtn) {
                    forceFullscreenBtn.addEventListener('click', () => {
                        const docEl = document.documentElement;

                        // Standard and browser-prefixed functions for requesting fullscreen
                        const requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
                        
                        // Standard and browser-prefixed functions for exiting fullscreen
                        const exitFullScreen = document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen || document.msExitFullscreen;

                        // Check if the page is currently in fullscreen mode
                        const isFullScreen = document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement;

                        if (!isFullScreen) {
                            if (requestFullScreen) {
                                requestFullScreen.call(docEl);
                            }
                        } else {
                            if (exitFullScreen) {
                                exitFullScreen.call(document);
                            }
                        }
                    });
                }


                document.getElementById('info-modal-next')?.addEventListener('click', () => {
                    if (this.infoModalCurrentSlide < this.infoModalTotalSlides) {
                        this.infoModalCurrentSlide++;
                        this.updateInfoModalSlide();
                    } else {
                        this.hideInfoModal();
                    }
                });
                
                document.getElementById('info-modal-prev')?.addEventListener('click', () => {
                    if (this.infoModalCurrentSlide > 1) {
                        this.infoModalCurrentSlide--;
                        this.updateInfoModalSlide();
                    }
                });
                
                const resizeHandle = document.getElementById('resize-handle')
                const trayResizeHandle = document.getElementById('tray-resize-handle');
                let isResizing = false;
                let isTrayResizing = false;

                
                if (resizeHandle) {
                    resizeHandle.addEventListener('mousedown', () => { isResizing = true; document.body.classList.add('is-resizing'); });
                }

                
                if (trayResizeHandle) {
                    trayResizeHandle.addEventListener('mousedown', () => { isTrayResizing = true; document.body.classList.add('is-tray-resizing'); });
                }
                window.addEventListener('mousemove', (e) => {
                    if (isResizing) {
                        let newWidth = e.clientX;
                        newWidth = Math.max(280, Math.min(newWidth, 600)); 
                        document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
                    }
                    if (isTrayResizing) {
                        let newHeight = window.innerHeight - e.clientY;
                        newHeight = Math.max(120, Math.min(newHeight, 500));
                        document.documentElement.style.setProperty('--animation-tray-height', `${newHeight}px`);
                    }
                });
                window.addEventListener('mouseup', () => {
                    if (isResizing) { isResizing = false; document.body.classList.remove('is-resizing'); this.plotter.onResize(); }
                    if (isTrayResizing) { isTrayResizing = false; document.body.classList.remove('is-tray-resizing'); }
                });


                document.getElementById('tutorial-next-btn')?.addEventListener('click', () => {
                    if (this.currentTutorialStep < this.tutorialSteps.length - 1) {
                        this.currentTutorialStep++;
                        this.showTutorialStep(this.currentTutorialStep);
                    } else {
                        this.endTutorial();
                    }
                });
                
                document.getElementById('tutorial-prev-btn')?.addEventListener('click', () => {
                    if (this.currentTutorialStep > 0) {
                        this.currentTutorialStep--;
                        this.showTutorialStep(this.currentTutorialStep);
                    }
                });
            }

            updateSlicingSliderRange(bounds) {
                if (!this.slicePositionSliders || typeof this.slicePositionSliders !== 'object') {
                    return;
                }
                
                
                if (!this.slicePositionSliders.x && !this.slicePositionSliders.y && !this.slicePositionSliders.z) {
                    return;
                }
            
                Object.keys(this.slicePositionSliders).forEach(axis => {
                    const slider = this.slicePositionSliders[axis];
                    if (slider) {
                        
                        let min = bounds.min[axis];
                        let max = bounds.max[axis];
            
                        
                        if (!isFinite(min)) min = -10;
                        if (!isFinite(max)) max = 10;
                        
                        
                        if (max <= min) {
                            max = min + 1; 
                        }
            
                        const range = max - min;
                        let step = range / 200;
            
                        
                        if (!isFinite(step) || step <= 0) {
                            step = 0.1;
                        }
            
                        slider.min = min;
                        slider.max = max;
                        slider.step = step;
            
                        
                        if (parseFloat(slider.value) < min || parseFloat(slider.value) > max) {
                             slider.value = min + range / 2;
                             
                             slider.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }
                });
            }
            

            debounce(func, wait) { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); }; }


            initializePresets() {
                this.presets = {
                    // ... (all single-mode presets remain the same)
                    surface: [
                        { name: 'Pulsing Wave', equation: '5*\\sin(0.4*\\sqrt{x^2+y^2} - T)' },
                        { name: 'Gaussian Pulse', equation: '10*e^(-0.2*(x^2+y^2)/(sin(T*0.5)^2+0.1))' },
                        { name: 'Warping Saddle', equation: '0.1*(x^2 - y^2) * (2 + \\cos(T))' },
                        { name: 'Monkey Saddle', equation: '0.05*(x^3 - 3*x*y^2)' },
                        { name: 'Ripple', equation: '2*\\cos(x + T)*\\sin(y - T)' },
                        { name: 'Funnel', equation: '10/\\sqrt{x^2+y^2+1}' },
                        { name: 'Interfering Waves', equation: '3*\\sin(\\sqrt{(x-4)^2+y^2}-T) + 3*\\sin(\\sqrt{(x+4)^2+y^2}-T) + 2*\\sin(\\sqrt{x^2+(y-3)^2}-T*0.7)' },
                        { name: 'Parabolic Reflector', equation: '0.15*(x^2 + y^2) + \\sin(T)*\\cos(0.3*\\sqrt{x^2+y^2})' },
                        { name: 'Egg Carton', equation: '2*(sin(x) + cos(y)) + 0.5*\\sin(x*y*0.1 + T)' },
                        { name: 'Butterfly Surface', equation: '5*e^(-0.1*(x^2+y^2)) * (\\sin(x*0.5)*\\cos(y*0.5) + 0.3*\\sin(2*x)*\\cos(2*y)) * (1 + 0.2*\\sin(T*2))' },
                        { name: 'Dragon Scales', equation: '3*\\sin(x*0.8)*\\sin(y*0.8) + 2*\\cos(x*1.2 + y*0.6)*\\sin(y*1.5 - x*0.3) + 0.5*\\sin(T + x + y)' },
                        { name: 'Quantum Field', equation: '5*e^(-0.05*(x^2+y^2))*\\cos(\\sqrt{x^2+y^2} - T) + 2*\\sin(x*0.5)*\\cos(y*0.5)*e^(-0.02*(x^2+y^2))' },
                        { name: 'Galactic Spiral', equation: '3*\\cos(2*atan2(y,x) + 0.1*\\sqrt{x^2+y^2) - T) * e^(-0.05*(x^2+y^2)) + \\sqrt{x^2+y^2}*0.1' },
                        { name: 'Morphing Lotus', equation: '4*\\cos(4*atan2(y,x) + T*0.5) * e^(-0.1*(x^2+y^2)) + 2*\\sin(\\sqrt{x^2+y^2} - T)' },
                        { name: 'Fractal Wave', equation: '3*\\sin(x) + 1.5*\\sin(2*x + y) + 0.7*\\sin(4*x + 2*y + T) + 0.3*\\sin(8*x + 4*y - T*2)' },
                        { name: 'Volcanic Crater', equation: '8*e^(-0.3*(x^2+y^2)) - 12*e^(-0.8*(x^2+y^2)) + 2*\\sin(5*atan2(y,x) + T)*e^(-0.2*(x^2+y^2))' },
                    ],
                    parametric: [
                        { name: 'Pulsing Sphere', xExpr: '(5+2*\\sin(T))\\cos(u)\\sin(v)', yExpr: '(5+2*\\sin(T))\\sin(u)\\sin(v)', zExpr: '(5+2*\\sin(T))\\cos(v)', uMax: 6.28, vMax: 3.14 },
                        { name: 'Wavy Torus', xExpr: '(5+2*\\cos(u))\\cos(v)', yExpr: '(5+2*\\cos(u))\\sin(v)', zExpr: '2*\\sin(u) + \\sin(v*5 + T*2)', uMax: 6.28, vMax: 6.28 },
                        { name: 'Seashell', xExpr: 'u/2*(1-u/(2*pi))*\\cos(u)*(1+\\cos(v))', yExpr: 'u/2*(1-u/(2*pi))*\\sin(u)*(1+\\cos(v))', zExpr: 'u/2*(1-u/(2*pi))*\\sin(v) + 2*u/(2*pi)', uMin: 0, uMax: 6.28, vMin: 0, vMax: 6.28, quality: 150 },
                        { name: 'Möbius Strip', xExpr: '(4+v*\\cos(u/2))\\cos(u)', yExpr: '(4+v*\\cos(u/2))\\sin(u)', zExpr: 'v*\\sin(u/2)', uMax: 6.28, vMin: -1.5, vMax: 1.5, quality: 100 },
                        { name: 'Klein Bottle', xExpr: '(2.5+\\cos(u/2)*\\sin(v)-\\sin(u/2)*\\sin(2*v))*\\cos(u)', yExpr: '(2.5+\\cos(u/2)*\\sin(v)-\\sin(u/2)*\\sin(2*v))*\\sin(u)', zExpr: '\\sin(u/2)*\\sin(v)+\\cos(u/2)*\\sin(2*v)', uMax: 6.28, vMax: 6.28, quality: 150 },
                        { name: 'Helicoid', xExpr: 'u*\\cos(v)', yExpr: 'u*\\sin(v)', zExpr: '1.5*v', uMin: -5, uMax: 5, vMin: -10, vMax: 10, quality: 80 },
                        { name: 'Torus Knot (3,2)', xExpr: '(3+\\cos(3*u + T*0.5))*\\cos(2*u)', yExpr: '(3+\\cos(3*u + T*0.5))*\\sin(2*u)', zExpr: '\\sin(3*u + T*0.3)', uMax: 6.28, quality: 150 },
                        { name: 'Dini\'s Surface', xExpr: '3*cos(u)*sin(v)', yExpr: '3*sin(u)*sin(v)', zExpr: '3*(cos(v) + log(tan(v/2))) + 0.5*u', uMax: 6.28, vMin: 0.1, vMax: 2, quality: 100 },
                        { name: 'Twisted Ribbon', xExpr: '(4 + u*\\cos(3*v + T))*\\cos(v)', yExpr: '(4 + u*\\cos(3*v + T))*\\sin(v)', zExpr: 'u*\\sin(3*v + T) + 2*\\sin(v*2)', uMin: -1, uMax: 1, vMax: 6.28, quality: 100 },
                        { name: 'Nautilus Shell', xExpr: 'e^(u*0.3)*\\cos(u)*\\cos(v)', yExpr: 'e^(u*0.3)*\\sin(u)*\\cos(v)', zExpr: 'e^(u*0.3)*\\sin(v) + u*0.1', uMin: 0, uMax: 15, vMin: -1.57, vMax: 1.57, quality: 150 },
                    ],
                    curve: [
                        { name: 'Wobble Helix', xExpr: '(3+\\sin(T*2)) * \\cos(t)', yExpr: '(3+\\sin(T*2)) * \\sin(t)', zExpr: '0.5*t', tMax: 30 },
                        { name: 'Trefoil Knot', xExpr: '\\sin(t)+2*\\sin(2*t)', yExpr: '\\cos(t)-2*\\cos(2*t)', zExpr: '-\\sin(3*t)', tMax: 6.28, quality: 800 },
                        { name: 'Lissajous 3D', xExpr: '4*\\sin(3*t + T)', yExpr: '4*\\cos(5*t)', zExpr: '4*\\sin(4*t)', tMax: 6.28, quality: 1000 },
                        { name: 'Butterfly 3D', xExpr: '4*\\sin(t)*(e^\\cos(t)-2*\\cos(4*t)-(\\sin(t/12))^5)', yExpr: '4*\\cos(t)*(e^\\cos(t)-2*\\cos(4*t)-(\\sin(t/12))^5)', zExpr: '2*\\cos(T/2)', tMin: 0, tMax: 12.56, quality: 1000 },
                        { name: 'Spiral Sphere', xExpr: '5*\\cos(t)*\\sin(t*0.2)', yExpr: '5*\\sin(t)*\\sin(t*0.2)', zExpr: '5*\\cos(t*0.2)', tMax: 62.8, quality: 1500 },
                        { name: 'Figure-Eight Knot', xExpr: '(2+\\cos(2*t))*\\cos(3*t)', yExpr: '(2+\\cos(2*t))*\\sin(3*t)', zExpr: '\\sin(4*t) + 0.5*\\sin(8*t)', tMax: 6.28, quality: 1000 },
                        { name: 'Viviani\'s Curve', xExpr: '2.5*(1+\\cos(t))', yExpr: '2.5*\\sin(t)', zExpr: '5*\\sin(t/2)', tMin: -6.28, tMax: 6.28, quality: 800 },
                        { name: 'Tornado Spiral', xExpr: '(10 - t*0.2)*\\cos(t*2)', yExpr: '(10 - t*0.2)*\\sin(t*2)', zExpr: 't', tMin: 0, tMax: 40, quality: 1200 },
                        { name: 'Lorenz Attractor', xExpr: '10*(sin(t*0.1) - cos(t*0.07))', yExpr: '28*sin(t*0.1) - cos(t*0.1)*sin(t*0.05)', zExpr: 'sin(t*0.1)*cos(t*0.07) - 8/3*sin(t*0.05)', tMax: 200, quality: 2000 },
                    ],
                    vector: [
                        { name: 'Rotational Flow', fx: '-y*\\cos(T)', fy: 'x*\\cos(T)', fz: '0.5*sin(T*2)' },
                        { name: 'Pulsing Source/Sink', fx: 'x*\\cos(T)', fy: 'y*\\cos(T)', fz: 'z*\\cos(T)' },
                        { name: 'Magnetic Field', fx: 'y', fy: 'z', fz: 'x', zMin: -2, zMax: 2, density: 12 },
                        { name: 'Vortex', fx: '-y/(x^2+y^2+0.1)', fy: 'x/(x^2+y^2+0.1)', fz: '0' },
                        { name: 'Saddle Flow', fx: 'x', fy: '-y', fz: '0' },
                        { name: 'Spiral Sink', fx: '(-x - 2*y)/sqrt(x^2+y^2+0.1)', fy: '(2*x - y)/sqrt(x^2+y^2+0.1)', fz: '-2*z' },
                        { name: 'Wave Field', fx: 'sin(z - T)', fy: 'cos(x - T)', fz: 'sin(y - T)' },
                        { name: 'Tornado', fx: '-y*exp(-0.1*(x^2+y^2))', fy: 'x*exp(-0.1*(x^2+y^2))', fz: '2 - 0.1*(x^2+y^2)' },
                    ],
                    'single-vector': [
                        { name: 'Basic', ox: 0, oy: 0, oz: 0, vx: 5, vy: 5, vz: 5, color: '#ffaa00' },
                        { name: 'Offset', ox: -2, oy: -2, oz: 0, vx: 4, vy: 4, vz: 4, color: '#00aaff' },
                        { name: 'Vertical', ox: 0, oy: 0, oz: -5, vx: 0, vy: 0, vz: 10, color: '#ff4444' },
                    ]
                };
            
                this.playgroundPresets = {
                    'Atom': [
                        // --- NUCLEUS ---
                        // Protons (Red)
                        { type: 'parametric', name: 'Proton 1', config: { xExpr: '0.3*cos(u)*sin(v)', yExpr: '0.3*sin(u)*sin(v)', zExpr: '0.3*cos(v)', uMax: 6.28, vMax: 3.14, quality: 20 }, colormap: 'Reds', animation: { modes: { p: true }, T: { max: 6.28 }, speed: 1.2, pos: { x: '0.5 + 0.1*sin(T*1.2)', y: '0.1*cos(T*0.8)', z: '0.1*cos(T*1.2)' } } },
                        { type: 'parametric', name: 'Proton 2', config: { xExpr: '0.3*cos(u)*sin(v)', yExpr: '0.3*sin(u)*sin(v)', zExpr: '0.3*cos(v)', uMax: 6.28, vMax: 3.14, quality: 20 }, colormap: 'Reds', animation: { modes: { p: true }, T: { max: 6.28 }, speed: 1.2, pos: { x: '-0.25+0.1*cos(T*1.5)', y: '0.43+0.1*sin(T*1.5)', z: '0' } } },
                        { type: 'parametric', name: 'Proton 3', config: { xExpr: '0.3*cos(u)*sin(v)', yExpr: '0.3*sin(u)*sin(v)', zExpr: '0.3*cos(v)', uMax: 6.28, vMax: 3.14, quality: 20 }, colormap: 'Reds', animation: { modes: { p: true }, T: { max: 6.28 }, speed: 1.2, pos: { x: '-0.25+0.1*sin(T)', y: '-0.43+0.1*cos(T)', z: '0' } } },
                        // Neutrons (Grey)
                        { type: 'parametric', name: 'Neutron 1', config: { xExpr: '0.3*cos(u)*sin(v)', yExpr: '0.3*sin(u)*sin(v)', zExpr: '0.3*cos(v)', uMax: 6.28, vMax: 3.14, quality: 20 }, colormap: 'Greys', animation: { modes: { p: true }, T: { max: 6.28 }, speed: 1.2, pos: { x: '0', y: '0.1*sin(T*1.3)', z: '0.5+0.1*sin(T*1.1)' } } },
                        { type: 'parametric', name: 'Neutron 2', config: { xExpr: '0.3*cos(u)*sin(v)', yExpr: '0.3*sin(u)*sin(v)', zExpr: '0.3*cos(v)', uMax: 6.28, vMax: 3.14, quality: 20 }, colormap: 'Greys', animation: { modes: { p: true }, T: { max: 6.28 }, speed: 1.2, pos: { x: '0', y: '0.1*cos(T*1.7)', z: '-0.5+0.1*cos(T*1.4)' } } },
                        { type: 'parametric', name: 'Neutron 3', config: { xExpr: '0.3*cos(u)*sin(v)', yExpr: '0.3*sin(u)*sin(v)', zExpr: '0.3*cos(v)', uMax: 6.28, vMax: 3.14, quality: 20 }, colormap: 'Greys', animation: { modes: { p: true }, T: { max: 6.28 }, speed: 1.2, pos: { x: '0.1*sin(T*1.8)', y: '0.8+0.1*cos(T*1.8)', z: '0' } } },
                        { type: 'parametric', name: 'Neutron 4', config: { xExpr: '0.3*cos(u)*sin(v)', yExpr: '0.3*sin(u)*sin(v)', zExpr: '0.3*cos(v)', uMax: 6.28, vMax: 3.14, quality: 20 }, colormap: 'Greys', animation: { modes: { p: true }, T: { max: 6.28 }, speed: 1.2, pos: { x: '0.1*cos(T*2.2)', y: '-0.8+0.1*sin(T*2.2)', z: '0' } } },
                        // Nucleus Shell (Transparent)
                        { type: 'parametric', name: 'Nucleus Shell', config: { xExpr: '1.2*cos(u)*sin(v)', yExpr: '1.2*sin(u)*sin(v)', zExpr: '1.2*cos(v)', uMax: 6.28, vMax: 3.14, quality: 40, opacity: 0.2 }, colormap: 'Greys' },
                
                        // --- ELECTRONS & ORBITS ---
                        // Electron 1 (Inner Orbit)
                        { type: 'curve', name: 'Electron Path 1', colormap: 'Plasma', config: { xExpr: '8*cos(t)', yExpr: '8*sin(t)*cos(0.5)', zExpr: '8*sin(t)*sin(0.5)', tMax: 6.28, quality: 400 } },
                        { type: 'parametric', name: 'Electron 1', config: { xExpr: '0.2*cos(u)*sin(v)', yExpr: '0.2*sin(u)*sin(v)', zExpr: '0.2*cos(v)', uMax: 6.28, vMax: 3.14, quality: 10 }, colormap: 'Blues', animation: { modes: { p: true }, T: { max: 6.28 }, speed: 1.2, pos: { x: '8*cos(T)', y: '8*sin(T)*cos(0.5)', z: '8*sin(T)*sin(0.5)' } } },
                        
                        // Electron 2 (Perpendicular Orbit)
                        { type: 'curve', name: 'Electron Path 2', colormap: 'Viridis', config: { xExpr: '10*cos(t)', yExpr: '2*sin(t)', zExpr: '10*sin(t)', tMax: 6.28, quality: 400 } },
                        { type: 'parametric', name: 'Electron 2', config: { xExpr: '0.2*cos(u)*sin(v)', yExpr: '0.2*sin(u)*sin(v)', zExpr: '0.2*cos(v)', uMax: 6.28, vMax: 3.14, quality: 10 }, colormap: 'Blues', animation: { modes: { p: true }, T: { max: 6.28 }, speed: 1.0, pos: { x: '10*cos(T)', y: '2*sin(T)', z: '10*sin(T)' } } },
                
                        // Electron 3 (Outer Wavy Orbit)
                        { type: 'curve', name: 'Electron Path 3', colormap: 'Jet', config: { xExpr: '12*cos(t)', yExpr: '12*sin(t)', zExpr: '1.5*cos(t*3)', tMax: 6.28, quality: 400 } },
                        { type: 'parametric', name: 'Electron 3', config: { xExpr: '0.2*cos(u)*sin(v)', yExpr: '0.2*sin(u)*sin(v)', zExpr: '0.2*cos(v)', uMax: 6.28, vMax: 3.14, quality: 10 }, colormap: 'Blues', animation: { modes: { p: true }, T: { max: 6.28 }, speed: 0.8, pos: { x: '12*cos(T)', y: '12*sin(T)', z: '1.5*cos(T*3)' } } }
                    ],
                    'Quantum Vortex': [
                        { type: 'parametric', name: 'Quantum Core', config: { xExpr: '(2 + 0.5*sin(8*u + T*3))*cos(u)*cos(v)', yExpr: '(2 + 0.5*sin(8*u + T*3))*cos(u)*sin(v)', zExpr: '(2 + 0.5*sin(8*u + T*3))*sin(u)', uMin: -1.57, uMax: 1.57, vMax: 6.28, quality: 80 }, colormap: 'Plasma', animation: { modes: { v: true, p: true }, T: { max: 6.28 }, speed: 1.5, rot: { x: 'T*20', y: 'T*30', z: 'T*15' } } },
                        { type: 'curve', name: 'EM Spiral 1', config: { xExpr: 't*0.3*cos(t*2 + T)', yExpr: 't*0.3*sin(t*2 + T)', zExpr: 't*0.1*sin(t*0.5 + T*2)', tMin: 0, tMax: 25, quality: 800 }, colormap: 'Viridis', animation: { modes: { v: true }, T: { max: 6.28 }, speed: 2 } },
                        { type: 'curve', name: 'EM Spiral 2', config: { xExpr: 't*0.3*cos(t*2 + T + 2.09)', yExpr: 't*0.3*sin(t*2 + T + 2.09)', zExpr: 't*0.1*sin(t*0.5 + T*2 + 1)', tMin: 0, tMax: 25, quality: 800 }, colormap: 'Blues', animation: { modes: { v: true }, T: { max: 6.28 }, speed: 1.8 } },
                        { type: 'curve', name: 'EM Spiral 3', config: { xExpr: 't*0.3*cos(t*2 + T + 4.19)', yExpr: 't*0.3*sin(t*2 + T + 4.19)', zExpr: 't*0.1*sin(t*0.5 + T*2 + 2)', tMin: 0, tMax: 25, quality: 800 }, colormap: 'Reds', animation: { modes: { v: true }, T: { max: 6.28 }, speed: 2.2 } },
                        { type: 'curve', name: 'Gravity Wave 1', config: { xExpr: '(8 + 2*sin(T*4))*cos(t)', yExpr: '(8 + 2*sin(T*4))*sin(t)', zExpr: '3*sin(t*3 + T*5)', tMax: 6.28, quality: 200 }, colormap: 'Hot', animation: { modes: { v: true }, T: { max: 6.28 }, speed: 1 } },
                        { type: 'curve', name: 'Gravity Wave 2', config: { xExpr: '(12 + 1.5*cos(T*3))*cos(t)', yExpr: '(12 + 1.5*cos(T*3))*sin(t)', zExpr: '2*cos(t*4 + T*3)', tMax: 6.28, quality: 200 }, colormap: 'Purples', animation: { modes: { v: true }, T: { max: 6.28 }, speed: 0.7 } },
                        { type: 'surface', name: 'Quantum Field', config: { equation: '3*e^(-0.03*(x^2+y^2))*cos(sqrt(x^2+y^2)*0.8 - T*2) + 2*sin(x*0.3)*cos(y*0.3)*e^(-0.01*(x^2+y^2))', xMin: -15, xMax: 15, yMin: -15, yMax: 15, quality: 100 }, colormap: 'Jet', animation: { modes: { v: true }, T: { max: 6.28 }, speed: 1.2 } },
                        { type: 'curve', name: 'Particle Stream 1', config: { xExpr: '15*cos(t*0.1 + T*5)', yExpr: '15*sin(t*0.1 + T*5)', zExpr: 't*0.05', tMin: -100, tMax: 100, quality: 400 }, colormap: 'Oranges', animation: { modes: { v: true }, T: { max: 6.28 }, speed: 3 } },
                        { type: 'curve', name: 'Particle Stream 2', config: { xExpr: '15*cos(t*0.1 + T*5 + 3.14)', yExpr: '15*sin(t*0.1 + T*5 + 3.14)', zExpr: 't*0.05', tMin: -100, tMax: 100, quality: 400 }, colormap: 'Greens', animation: { modes: { v: true }, T: { max: 6.28 }, speed: 2.5 } }
                    ]
                }
            }
            
            


            renderPresets() {
                const container = document.getElementById('presets-container');
                if (!container) return;
                container.innerHTML = '';
            
                const presetsSource = this.currentMode === 'playground' ? this.playgroundPresets : this.presets[this.currentMode];
                if (!presetsSource) return;
            
                
                if (this.currentMode === 'playground') {
                    Object.entries(presetsSource).forEach(([name, data]) => {
                        const card = document.createElement('button');
                        card.className = 'preset-card btn btn-secondary text-xs transition-all duration-200';
                        card.textContent = name; 
                        card.onclick = () => { this.loadPlaygroundPreset(data); };
                        container.appendChild(card);
                    });
                } else {
                    
                    presetsSource.forEach(presetData => {
                        const card = document.createElement('button');
                        card.className = 'preset-card btn btn-secondary text-xs transition-all duration-200';
                        card.textContent = presetData.name; 
                        card.onclick = () => { this.loadPreset(presetData); };
                        container.appendChild(card);
                    });
                }
            }

            loadPlaygroundPreset(presetObjects) {
                this.stopAllAnimations();
                this.playgroundObjects = [];
                this.focusedObjectId = null;
                this.plotter.clearPlots();
                this.plotQueue = []; 
            
                presetObjects.forEach(presetObj => {
                    const newObject = this.addPlaygroundObject(presetObj.type, false); 
                    newObject.name = presetObj.name;
                    newObject.config = { ...newObject.config, ...presetObj.config };
                    if (presetObj.colormap) newObject.colormap = presetObj.colormap;
                    if (presetObj.animation) {
                        newObject.animation = $.extend(true, {}, this.getDefaultAnimationConfig(newObject.type), presetObj.animation);
                    }
                    
                    this.plotQueue.push(newObject.id); 
                });
            
                this.renderPlaygroundUI();
                this.renderGlobalAnimationTray();
            
                
                this.processNextInQueue();
            }

            loadPreset(preset) {
                if (this.currentMode === 'playground' || this.playgroundObjects.length === 0) return;
                const obj = this.playgroundObjects[0];
                if (!obj || obj.type !== this.currentMode) return;

                this.hideError(obj.id);
                this.stopAnimation(obj.id);
                obj.config = { ...this.getDefaultConfig(obj.type), ...preset };

                this.renderPlaygroundUI();
                this.renderGlobalAnimationTray();
                this.plot(obj.id);
            }

            renderColormapSelector(container, currentMap, callback) {
                if (!container) return;
            
                const importantColormaps = {
                    'Plasma': this.colormaps['Plasma'],
                    'Viridis': this.colormaps['Viridis'],
                    'Jet': this.colormaps['Jet'],
                    'Hot': this.colormaps['Hot'],
                    'Greys': this.colormaps['Greys']
                };
            
                container.innerHTML = '';
                Object.entries(importantColormaps).forEach(([id, { name, gradient }]) => {
                    const button = document.createElement('button');
                    button.className = 'colormap-btn h-8 w-full';
                    button.title = name;
                    button.style.background = gradient;
            
                    if (id === currentMap) {
                        button.classList.add('active');
                    }
            
                    button.addEventListener('click', () => {
                        callback(id);
                        container.querySelectorAll('.colormap-btn').forEach(btn => btn.classList.remove('active'));
                        button.classList.add('active');
                        this.plotter.updateSinglePlot(this.getPlaygroundObject(container.closest('[data-object-id]').dataset.objectId), document.getElementById('wireframe-toggle').checked);
                    });
                    container.appendChild(button);
                });
            }

            fitViewToObjects() {
                const combinedBounds = new THREE.Box3();
                let hasContent = false;
            
                // Calculate the total bounds of all visible objects
                this.playgroundObjects.forEach(obj => {
                    if (obj.visible && obj.threeMesh) {
                        const objectBounds = this.plotter.calculateObjectBounds(obj.threeMesh);
                        if (!objectBounds.isEmpty()) {
                            combinedBounds.union(objectBounds);
                            hasContent = true;
                        }
                    }
                });
            
                // If there's anything to frame, update the grid
                if (hasContent) {
                    const size = combinedBounds.getSize(new THREE.Vector3());
                    const padding = size.length() * 0.1; // Add 10% padding
                    combinedBounds.expandByScalar(padding > 0.5 ? padding : 0.5);
            
                    // We need a way to tell the plotter to use these new bounds
                    this.plotter.setGridBounds(combinedBounds);
                } else {
                    this.showToast("No objects to fit view to.");
                }
            }

            startTutorial() {
                this.tutorialIsActive = true;
                this.currentTutorialStep = 0;
                document.getElementById('tutorial-modal-overlay')?.classList.remove('hidden');
                
                // This check prevents adding a new object if the Atom preset is already loaded
                if(this.playgroundObjects.length === 0) {
                    this.addPlaygroundObject('surface', true);
                }
                this.showTutorialStep(this.currentTutorialStep);
            }
            
            endTutorial() {
                document.getElementById('tutorial-modal-overlay')?.classList.add('hidden');
                document.getElementById('tutorial-highlighter').style.display = 'none';
                localStorage.setItem('plotterProTutorialCompleted', 'true');
                this.tutorialIsActive = false;
                this.renderGlobalAnimationTray();
            
                // Start the animations after the tutorial is done
                this.playAllAnimations();
            }
            
            showTutorialStep(stepIndex) {
                const step = this.tutorialSteps[stepIndex];
                if (!step) return;
            
                document.getElementById('tutorial-title').textContent = step.title;
                document.getElementById('tutorial-text').textContent = step.text;
                document.getElementById('tutorial-counter').textContent = `${stepIndex + 1} / ${this.tutorialSteps.length}`;
            
                const highlighter = document.getElementById('tutorial-highlighter');
                const modalPanel = document.getElementById('tutorial-modal-panel');
                const targetElement = step.selector ? document.querySelector(step.selector) : null;
            
                if (targetElement) {
                    const rect = targetElement.getBoundingClientRect();
                    highlighter.style.display = 'block';
                    highlighter.style.top = `${rect.top - 4}px`;
                    highlighter.style.left = `${rect.left - 4}px`;
                    highlighter.style.width = `${rect.width + 8}px`;
                    highlighter.style.height = `${rect.height + 8}px`;
                    
                    
                    modalPanel.style.position = 'fixed'; 
                    modalPanel.style.transform = 'none'; 
            
                    
                    let top = rect.bottom + 15;
                    if (top + modalPanel.offsetHeight > window.innerHeight) {
                        top = rect.top - modalPanel.offsetHeight - 15;
                    }
            
                    
                    let left = rect.left;
                    if (left + modalPanel.offsetWidth > window.innerWidth) {
                        left = window.innerWidth - modalPanel.offsetWidth - 15;
                    }
                    
                    
                    if (left < 15) left = 15;
                    if (top < 15) top = 15;
            
                    modalPanel.style.top = `${top}px`;
                    modalPanel.style.left = `${left}px`;
                    
                } else {
                    
                    highlighter.style.display = 'none';
                    modalPanel.style.position = 'relative'; 
                    modalPanel.style.top = 'auto';
                    modalPanel.style.left = 'auto';
                    modalPanel.style.transform = 'none';
                }
            
                document.getElementById('tutorial-prev-btn').style.visibility = (stepIndex === 0) ? 'hidden' : 'visible';
                const nextButton = document.getElementById('tutorial-next-btn');
                nextButton.textContent = (stepIndex === this.tutorialSteps.length - 1) ? 'Finish' : 'Next';
            }

            switchMode(mode, initial = false) {
                // Handle Linear Algebra mode navigation
                if (mode === 'linear-algebra') {
                    this.navigateToLinearAlgebra();
                    return;
                }

                this.stopAllAnimations();

                this.syncUItoState();
                if (this.currentMode && this.playgroundObjects.length > 0) {
                    this.modeStates[this.currentMode] = this.playgroundObjects;
                }

                this.currentMode = mode;
                this.activeMathFieldId = null;
                this.focusedObjectId = null;
                this.modeTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));

                this.playgroundObjects = this.modeStates[mode] || [];

                if (mode === 'playground') {
                    this.singleModeControls.classList.add('hidden');
                    this.playgroundControls.classList.remove('hidden');
                    this.presetsTitle.textContent = 'Playground Presets';
                    if (this.playgroundObjects.length === 0 && !initial) {
                        this.addPlaygroundObject('surface', true);
                    }
                } else {
                    this.singleModeControls.classList.remove('hidden');
                    this.playgroundControls.classList.add('hidden');
                    this.presetsTitle.textContent = 'Presets';

                    const configContainer = this.singleModeControls.querySelector('.accordion-content .space-y-5');
                    if (configContainer) {
                        configContainer.querySelectorAll(':scope > div').forEach(div => div.classList.add('hidden'));
                    
                        const currentControls = configContainer.querySelector(`.${mode}-controls`);
                        if (currentControls) {
                            currentControls.classList.remove('hidden');
                        }else{this.showToast(`[Debug] CRITICAL: Could not find controls container for mode: .${mode}-controls`);}
                    }

                    if (this.playgroundObjects.length === 0) {
                        this.addPlaygroundObject(mode, !initial);
                        this.modeStates[mode] = this.playgroundObjects;
                    }
                }

                this.renderPlaygroundUI();
                this.renderPresets();
                this.renderGlobalAnimationTray();
                this.plotter.clearPlots();
                this.playgroundObjects.forEach(obj => {
                    this.plot(obj.id);
                });
                this.updateGlobalPlayPauseButton();
            }

            addPlaygroundObject(type, shouldPlot = true) {
                const id = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                const preset = this.presets[type]?.[0] || {};
                const newObject = {
                    id: id, type: type,
                    name: `${type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} ${this.playgroundObjects.filter(o => o.type === type).length + 1}`,
                    visible: true, config: this.getDefaultConfig(type, preset),
                    colormap: 'Plasma',
                    lastData: null,
                    threeMesh: null,
                    animation: this.getDefaultAnimationConfig(type)
                };
                this.playgroundObjects.push(newObject);
                this.renderPlaygroundUI();
                this.renderGlobalAnimationTray();
                this.plotter.updateAxesAndGrid();
                if (shouldPlot) this.plot(id);
                return newObject;
            }

            removePlaygroundObject(id) {
                this.stopAnimation(id);
                if(this.focusedObjectId === id) this.setFocus(null);
                const obj = this.getPlaygroundObject(id);
                if (obj && obj.threeMesh) {
                     this.plotter.plotGroup.remove(obj.threeMesh);
                }
                this.playgroundObjects = this.playgroundObjects.filter(obj => obj.id !== id);
                this.renderPlaygroundUI();
                this.renderGlobalAnimationTray();
                this.plotter.updateAxesAndGrid();
                this.renderAllPlots();
            }

            setFocus(id) {
                this.focusedObjectId = id;
                document.querySelectorAll('.playground-object').forEach(el => {
                    el.classList.toggle('focused', el.dataset.objectId === id);
                });
                this.plotter.updateAxesAndGrid();
            }

            getPlaygroundObject(id) { return this.playgroundObjects.find(obj => obj.id === id); }
            getPlaygroundObjectByMesh(mesh) {
                if (!mesh.userData.objectId) return null;
                return this.getPlaygroundObject(mesh.userData.objectId);
            }

            getDefaultConfig(type, preset = {}) {
                const baseConfig = { quality: 100, opacity: 1.0 };
                switch(type) {
                    case 'surface': return { ...baseConfig, equation: 'x^2-y^2', xMin: -5, xMax: 5, yMin: -5, yMax: 5, ...preset };
                    case 'parametric': return { ...baseConfig, quality: 100, xExpr: 'u', yExpr: 'v', zExpr: 'u*v', uMin: 0, uMax: 6.28, vMin: 0, vMax: 6.28, ...preset };
                    case 'curve': return { ...baseConfig, quality: 500, xExpr: '\\cos(t)', yExpr: '\\sin(t)', zExpr: 't', tMin: 0, tMax: 10, ...preset };
                    case 'vector': return { ...baseConfig, density: 10, scale: 1.0, fx: 'x', fy: 'y', fz: '0', xMin: -3, xMax: 3, yMin: -3, yMax: 3, zMin: -3, zMax: 3, ...preset };
                    case 'single-vector': return { ox: 0, oy: 0, oz: 0, vx: 1, vy: 1, vz: 1, color: '#ffffff', ...preset };
                }
                return baseConfig;
            }

            renderPlaygroundUI() {
                if (this.currentMode === 'playground') {
                    this.playgroundObjectsContainer.innerHTML = '';
                    if (this.playgroundObjects.length === 0) {
                        this.playgroundObjectsContainer.innerHTML = `<div class="text-center text-text-muted p-8 border-2 border-dashed border-border-color rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                            <h3 class="text-lg font-semibold text-text-light">Empty Playground</h3>
                            <p>Click "Add Object" to start plotting.</p>
                        </div>`;
                    } else {
                        this.playgroundObjects.forEach(obj => {
                            const div = document.createElement('div');
                            div.className = 'playground-object';
                            if(this.focusedObjectId === obj.id) div.classList.add('focused');
                            div.dataset.objectId = obj.id;
                            div.innerHTML = this.getPlaygroundObjectHTML(obj);
                            this.playgroundObjectsContainer.appendChild(div);
                            this.initializeMathFields(div);
                            this.setupPlaygroundObjectListeners(div, obj);
                        });
                    }
                } else {
                    const container = this.singleModeControls.querySelector(`.${this.currentMode}-controls`);
                    if (!container) return;
                    container.innerHTML = '';
                    const obj = this.playgroundObjects[0];
                    if (obj) {
                        const div = document.createElement('div');
                        div.dataset.objectId = obj.id;
                        div.innerHTML = this.getPlaygroundObjectHTML(obj);
                        container.appendChild(div);
                        this.initializeMathFields(div);
                    }
                    this.renderAppearanceSettings();
                }
            }

            setupPlaygroundObjectListeners(div, obj) {
                div.querySelector('.focus-object-btn')?.addEventListener('click', () => this.setFocus(obj.id));
                div.querySelector('.remove-object-btn')?.addEventListener('click', () => this.removePlaygroundObject(obj.id));

                const visibilityBtn = div.querySelector('.toggle-visibility-btn');
                if(visibilityBtn) {
                    visibilityBtn.addEventListener('click', (e) => {
                        obj.visible = !obj.visible;
                        if (obj.threeMesh) {
                            obj.threeMesh.visible = obj.visible;
                            this.applyAdvancedTransforms(obj); 
                        }
                        e.currentTarget.classList.toggle('opacity-50', !obj.visible);
                        this.plotter.updateAxesAndGrid();
                        this.renderAllPlots();
                    });
                }

                const accordionHeader = div.querySelector('.accordion-header');
                if (accordionHeader) {
                    accordionHeader.addEventListener('click', (e) => {
                        if (e.target.closest('button, input')) return;
                        const content = div.querySelector('.accordion-content');
                        const isOpen = content.classList.toggle('open');
                        content.style.maxHeight = isOpen ? content.scrollHeight + 20 + "px" : '0px';
                        e.currentTarget.classList.toggle('open');
                    });
                }

                const appearanceDetails = div.querySelector('.appearance-accordion');
                const mainAccordionContent = div.querySelector('.accordion-content');

                if (appearanceDetails && mainAccordionContent) {
                    appearanceDetails.addEventListener('toggle', () => {
                        if (mainAccordionContent.classList.contains('open')) {
                            mainAccordionContent.style.maxHeight = mainAccordionContent.scrollHeight + 20 + 'px';
                        }
                    });
                }

                const colormapContainer = div.querySelector('.colormap-selector-playground');
                if (colormapContainer) {
                    this.renderColormapSelector(colormapContainer, obj.colormap, (newMap) => {
                        obj.colormap = newMap;
                        this.plotter.updateSinglePlot(obj, document.getElementById('wireframe-toggle').checked);
                    });
                }
            }

            renderAppearanceSettings() {
                const container = document.getElementById('appearance-settings');
                if (!container) return;
            
                const obj = this.playgroundObjects[0];
                if (!obj || obj.type === 'single-vector') { container.innerHTML = ''; return; }
            
                let qualityControlHTML = '';
                const opacityHTML = `<div><label>Opacity: <span class="range-value-display font-mono text-secondary">${parseFloat(obj.config.opacity).toFixed(2)}</span></label><input type="range" min="0" max="1" step="0.05" value="${obj.config.opacity}" data-config="opacity"></div>`;
            
                switch(obj.type) {
                    case 'surface': case 'parametric':
                        qualityControlHTML = `<div><label>Quality: <span class="range-value-display font-mono text-secondary">${obj.config.quality}</span></label><input type="range" min="20" max="200" step="10" value="${obj.config.quality}" data-config="quality"></div>`;
                        break;
                    case 'curve':
                        qualityControlHTML = `<div><label>Quality: <span class="range-value-display font-mono text-secondary">${obj.config.quality}</span></label><input type="range" min="50" max="2000" step="10" value="${obj.config.quality}" data-config="quality"></div>`;
                        break;
                    case 'vector':
                        qualityControlHTML = `
                            <div><label>Density: <span class="range-value-display font-mono text-secondary">${obj.config.density}</span></label><input type="range" min="4" max="40" step="1" value="${obj.config.density}" data-config="density"></div>
                            <div><label>Arrow Scale: <span class="range-value-display font-mono text-secondary">${parseFloat(obj.config.scale).toFixed(2)}</span></label><input type="range" min="0.1" max="3" step="0.05" value="${obj.config.scale}" data-config="scale"></div>`;
                        break;
                }
            
                container.innerHTML = `
                    <div data-object-id="${obj.id}" class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            ${qualityControlHTML}
                            ${opacityHTML}
                        </div>
                        <div>
                            <label>Color Map</label>
                            <div id="single-mode-colormap" class="grid grid-cols-5 gap-2 mt-2"></div>
                        </div>
                        <div class="border-t border-border-color pt-4 mt-4">
                            <label class="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" data-config="useShader" class="form-checkbox h-5 w-5 text-secondary rounded" ${obj.config.useShader ? 'checked' : ''}>
                                <span class="font-medium">Use Advanced Shading</span>
                            </label>
                            <p class="text-xs text-text-muted mt-1">Note: Advanced shading may not be compatible with the slicing plane feature.</p>
                        </div>
                    </div>`;
            
                const colormapContainer = container.querySelector('#single-mode-colormap');
                this.renderColormapSelector(colormapContainer, obj.colormap, (newMap) => {
                    obj.colormap = newMap;
                    this.plotter.updateSinglePlot(obj, document.getElementById('wireframe-toggle').checked);
                });
            }


            getPlaygroundObjectHTML(obj) {
                const c = obj.config;
                let fieldsHTML = '';
                const isSingleMode = this.currentMode !== 'playground';
            
                const createMathInputGroup = (label, id, latexValue) => `
                    <div class="math-input-group">
                        <div class="flex justify-between items-center mb-1">
                            <label>${label}</label>
                            <div class="math-input-actions">
                                <button title="Copy LaTeX" class="math-input-action-btn" data-action="copy-latex" data-field-id="${id}">L</button>
                                <button title="Copy MathJS" class="math-input-action-btn" data-action="copy-mathjs" data-field-id="${id}">M</button>
                            </div>
                        </div>
                        <div class="math-input-container">
                            <span id="${id}" class="math-input-field">${latexValue}</span>
                            <button class="calc-trigger-btn" data-field-id="${id}" title="Open Calculator">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="8" y1="7" x2="16" y2="7"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="17" x2="16" y2="17"></line></svg>
                            </button>
                        </div>
                    </div>`;
            
                const createRangeInputs = (vars) => {
                    return vars.map(v => `
                        <div>
                            <label class="uppercase">${v} Range (Min/Max)</label>
                            <div class="grid grid-cols-2 gap-2">
                                <input type="number" step="0.1" value="${c[`${v}Min`]}" class="form-input" data-config="${v}Min">
                                <input type="number" step="0.1" value="${c[`${v}Max`]}" class="form-input" data-config="${v}Max">
                            </div>
                        </div>
                    `).join('');
                };
            
                switch(obj.type) {
                    case 'surface':
                        fieldsHTML = `${createMathInputGroup('z = f(x, y, T)', `eq-${obj.id}`, c.equation)} ${createRangeInputs(['x', 'y'])}`;
                        break;
                    case 'parametric':
                        fieldsHTML = `${createMathInputGroup('x(u,v,T)', `px-${obj.id}`, c.xExpr)} ${createMathInputGroup('y(u,v,T)', `py-${obj.id}`, c.yExpr)} ${createMathInputGroup('z(u,v,T)', `pz-${obj.id}`, c.zExpr)} ${createRangeInputs(['u', 'v'])}`;
                        break;

                    case 'curve':
                        fieldsHTML = `${createMathInputGroup('x(t,T)', `cx-${obj.id}`, c.xExpr)} ${createMathInputGroup('y(t,T)', `cy-${obj.id}`, c.yExpr)} ${createMathInputGroup('z(t,T)', `cz-${obj.id}`, c.zExpr)} ${createRangeInputs(['t'])}`;
                        break;
                    case 'vector':
                        fieldsHTML = `${createMathInputGroup('F_x(x,y,z,T)', `vx-${obj.id}`, c.fx)} ${createMathInputGroup('F_y(x,y,z,T)', `vy-${obj.id}`, c.fy)} ${createMathInputGroup('F_z(x,y,z,T)', `vz-${obj.id}`, c.fz)} ${createRangeInputs(['x', 'y', 'z'])}`;
                        break;
                    case 'single-vector': 
                        fieldsHTML = `<div class="grid grid-cols-2 gap-4 mt-2"> <div> <label>Origin (x, y, z)</label> <div class="grid grid-cols-3 gap-2"> <input type="number" step="0.1" value="${c.ox}" class="form-input w-full text-xs p-1" data-config="ox"> <input type="number" step="0.1" value="${c.oy}" class="form-input w-full text-xs p-1" data-config="oy"> <input type="number" step="0.1" value="${c.oz}" class="form-input w-full text-xs p-1" data-config="oz"> </div> </div> <div> <label>Vector (i, j, k)</label> <div class="grid grid-cols-3 gap-2"> <input type="number" step="0.1" value="${c.vx}" class="form-input w-full text-xs p-1" data-config="vx"> <input type="number" step="0.1" value="${c.vy}" class="form-input w-full text-xs p-1" data-config="vy"> <input type="number" step="0.1" value="${c.vz}" class="form-input w-full text-xs p-1" data-config="vz"> </div> </div> <div class="col-span-2"> <label>Color</label> <input type="color" value="${c.color}" class="form-input w-full h-10 p-1" data-config="color">    <div class="col-span-2"> 
        <label>Color</label> 
        <input type="color" value="${c.color}" class="form-input w-full h-10 p-1" data-config="color"> 
    </div>
    
    <div class="col-span-2">
        <label>Visual Scale: <span class="range-value-display font-mono text-secondary">${parseFloat(c.visualScale || 1.0).toFixed(2)}</span></label>
        <input type="range" min="0.2" max="5" step="0.1" value="${c.visualScale || 1.0}" data-config="visualScale">
    </div> </div> </div>`; 
                        break;
                }
            
                const headerHTML = isSingleMode ? '' : `
                    <div class="accordion-header compact-object-header">
                        <span class="object-name">${obj.name}</span>
                        <div class="object-actions">
                            <button title="Toggle Visibility" class="toggle-visibility-btn tool-button ${obj.visible ? '' : 'opacity-40'}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                            <button title="Remove Object" class="remove-object-btn tool-button hover:bg-red-500/20 hover:text-red-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                            <span class="chevron-container !w-6 !h-6">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="chevron"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </span>
                        </div>
                    </div>`;
                
                const contentClass = isSingleMode ? '' : 'accordion-content';
                const paddingClass = isSingleMode ? '' : 'p-3';
                
                let appearanceHTML = '';
                if (!isSingleMode && obj.type !== 'single-vector') {
                    let qualityControlHTML = '';
                    const opacityHTML = `<div><label>Opacity: <span class="range-value-display font-mono text-secondary">${parseFloat(c.opacity).toFixed(2)}</span></label><input type="range" min="0" max="1" step="0.05" value="${c.opacity}" data-config="opacity"></div>`;
                    if (obj.type === 'vector') {
                        qualityControlHTML = `
                            <div><label>Density: <span class="range-value-display font-mono text-secondary">${c.density}</span></label><input type="range" min="4" max="40" step="1" value="${c.density}" data-config="density"></div>
                            <div><label>Arrow Scale: <span class="range-value-display font-mono text-secondary">${parseFloat(c.scale).toFixed(2)}</span></label><input type="range" min="0.1" max="3" step="0.05" value="${c.scale}" data-config="scale"></div>
                        `;
                    } else {
                         qualityControlHTML = `<div><label>Quality: <span class="range-value-display font-mono text-secondary">${c.quality}</span></label><input type="range" min="${obj.type === 'curve' ? 50 : 20}" max="${obj.type === 'curve' ? 2000 : 200}" step="10" value="${c.quality}" data-config="quality"></div>`;
                    }
                    appearanceHTML = `
                        <details class="appearance-accordion border border-border-subtle rounded-lg mt-3">
                            <summary class="p-2 cursor-pointer font-semibold text-sm">Appearance</summary>
                            <div class="p-2 border-t border-border-subtle space-y-3">
                                <div class="grid grid-cols-2 gap-3">
                                    ${qualityControlHTML}
                                    ${opacityHTML}
                                </div>
                                <div>
                                    <label class="text-xs font-medium">Color Map</label>
                                    <div class="colormap-selector-playground grid grid-cols-5 gap-2 mt-1"></div>
                                </div>
                            </div>
                        </details>`;
                }
            
                return `${headerHTML} <div class="${contentClass}"> <div class="${paddingClass} space-y-3"> ${fieldsHTML} ${appearanceHTML} <div id="error-${obj.id}" class="error-badge hidden text-red-400 text-xs p-2 bg-red-500/10 rounded"></div> </div> </div>`;
            }

            renderGlobalAnimationTray() {
                const animatableObjects = this.playgroundObjects.filter(obj => obj.animation);
                const cardsContainer = document.getElementById('animation-cards-container');
            
                if (!cardsContainer) return;
            
                if (animatableObjects.length === 0 && !this.tutorialIsActive) {
                    this.animationTray.classList.add('hidden');
                    return;
                }
            
                this.animationTray.classList.remove('hidden');
                cardsContainer.innerHTML = ''; 
            
                const accentColors = ['var(--color-primary)', 'rgb(34, 197, 94)', 'rgb(236, 72, 153)', 'rgb(250, 204, 21)'];
            
                animatableObjects.forEach((obj, index) => {
                    const anim = obj.animation;
                    const id = obj.id;
                    const themeColor = accentColors[index % accentColors.length];
            
                    const easingOptions = Object.keys(this.Easing).map(name => `<option value="${name}" ${anim.easing === name ? 'selected' : ''}>${name}</option>`).join('');
                    const initialVisiblePanel = 'v'; 
            
                    const controllerHTML = `
                        <div class="anim-tray-controller" data-object-id="${id}" style="--component-accent: ${themeColor};">
                            <header class="anim-tray-header">
                                <h3 title="${obj.name}"><span class="accent-dot">●</span> ${obj.name}</h3>
                                <div class="anim-tray-mode-toggle">
                                    <input type="radio" id="panel-v-${id}" name="panel-toggle-${id}" value="v-mode" ${initialVisiblePanel === 'v' ? 'checked' : ''}><label for="panel-v-${id}">V</label>
                                    <input type="radio" id="panel-p-${id}" name="panel-toggle-${id}" value="p-mode" ${initialVisiblePanel === 'p' ? 'checked' : ''}><label for="panel-p-${id}">P</label>
                                    <input type="radio" id="panel-physics-${id}" name="panel-toggle-${id}" value="physics-mode" ${initialVisiblePanel === 'physics' ? 'checked' : ''}><label for="panel-physics-${id}">Physics</label>
                                </div>
                            </header>
                            <section class="anim-tray-player">
                                <button class="icon-btn anim-play-pause"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button>
                                <button class="icon-btn anim-reset-btn" title="Reset Animation"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>
                                <button class="icon-btn anim-loop-toggle"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2.1l4 4-4 4"/><path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8"/><path d="M7 21.9l-4-4 4-4"/><path d="M21 11.8v2a4 4 0 0 1-4 4H4.2"/></svg></button>
                                <input type="range" class="slider anim-slider" min="${anim.T.min}" max="${anim.T.max}" value="${anim.T.current}" step="${(anim.T.max - anim.T.min) / 1000}">
                                <span class="slider-value anim-val">${anim.T.current.toFixed(2)}</span>
                            </section>
            
                            <div class="v-mode-content hidden">
                                <label class="legend-checkbox p-2 font-bold">
                                    <input type="checkbox" data-mode="v" class="mode-enable-toggle h-4 w-4" ${anim.modes.v ? 'checked' : ''}> Enable V-Mode (Geometry)
                                </label>
                                <fieldset class="anim-tray-fieldset">
                                    <legend>Animation Control</legend>
                                    <div class="grid grid-cols-2 gap-2">
                                        <input type="number" value="${anim.T.min}" data-range="min" class="compact-input anim-controller-range">
                                        <input type="number" value="${anim.T.max}" data-range="max" class="compact-input anim-controller-range">
                                        <input type="number" value="${anim.speed}" step="0.01" data-range="speed" class="compact-input anim-controller-speed">
                                        <select class="compact-select anim-easing-select">${easingOptions}</select>
            
                                        ${Object.keys(anim.targetVars || {}).map(v => `
                                        <div class="col-span-2">
                                            <label class="legend-checkbox">
                                                <input type="checkbox" data-var="${v}" class="var-toggle h-3 w-3" ${anim.targetVars[v] ? 'checked' : ''}>
                                                Override ${v.toUpperCase()}
                                            </label>
                                            <div class="grid grid-cols-2 gap-2 mt-1">
                                                <input type="number" value="${anim.varRanges[v].min}" placeholder="Min" data-var="${v}" data-range="min" class="compact-input anim-var-range">
                                                <input type="number" value="${anim.varRanges[v].max}" placeholder="Max" data-var="${v}" data-range="max" class="compact-input anim-var-range">
                                            </div>
                                        </div>
                                        `).join('')}
                                        </div>
                                </fieldset>
                            </div>
            
                            <div class="p-mode-content hidden">
                                <label class="legend-checkbox p-2 font-bold">
                                    <input type="checkbox" data-mode="p" class="mode-enable-toggle h-4 w-4" ${anim.modes.p ? 'checked' : ''}> Enable P-Mode (Transforms)
                                </label>
                                <div class="space-y-2 p-1">
                                    <div>
                                        <label class="p-mode-row-label">Position Offset (X,Y,Z)</label>
                                        <div class="grid grid-cols-3 gap-2"><input type="text" class="compact-input" data-type="pos" data-axis="x" value="${anim.pos.x}"><input type="text" class="compact-input" data-type="pos" data-axis="y" value="${anim.pos.y}"><input type="text" class="compact-input" data-type="pos" data-axis="z" value="${anim.pos.z}"></div>
                                    </div>
                                    <div>
                                        <label class="p-mode-row-label">Rotation Offset (deg)</label>
                                        <div class="grid grid-cols-3 gap-2"><input type="text" class="compact-input" data-type="rot" data-axis="x" value="${anim.rot.x}"><input type="text" class="compact-input" data-type="rot" data-axis="y" value="${anim.rot.y}"><input type="text" class="compact-input" data-type="rot" data-axis="z" value="${anim.rot.z}"></div>
                                    </div>
                                    <div>
                                        <label class="p-mode-row-label">Scale (X,Y,Z)</label>
                                        <div class="grid grid-cols-3 gap-2"><input type="text" class="compact-input" data-type="scale" data-axis="x" value="${anim.scale.x}"><input type="text" class="compact-input" data-type="scale" data-axis="y" value="${anim.scale.y}"><input type="text" class="compact-input" data-type="scale" data-axis="z" value="${anim.scale.z}"></div>
                                    </div>
                                </div>
                            </div>
            
                            <div class="physics-mode-content hidden">
                                <label class="legend-checkbox p-2 font-bold">
                                    <input type="checkbox" data-mode="physics" class="mode-enable-toggle h-4 w-4" ${anim.modes.physics ? 'checked' : ''}> Enable Physics
                                </label>
                                <div class="space-y-1">
                                    <fieldset class="anim-tray-fieldset">
                                        <legend>Properties</legend>
                                        <div class="grid grid-cols-2 gap-2">
                                            <input type="number" step="0.1" class="compact-input" placeholder="Mass" data-prop="mass" value="${anim.path.physics.mass}">
                                            <input type="number" step="0.1" class="compact-input" placeholder="Gravity" data-prop="gravity" value="${anim.path.physics.gravity}">
                                            <input type="text" class="compact-input col-span-2" placeholder="Thrust (Expression)" data-prop="thrust" value="${anim.path.physics.thrust}">
                                            <input type="number" step="0.01" class="compact-input col-span-2" placeholder="Drag Coeff." data-prop="drag" value="${anim.path.physics.drag}">
                                            <label class="legend-checkbox mt-1 col-span-2"><input type="checkbox" class="path-auto-rotate h-4 w-4" ${anim.path.autoRotate ? 'checked' : ''}>Auto-Rotate</label>
                                        </div>
                                    </fieldset>
                                    <fieldset class="anim-tray-fieldset">
                                        <legend>Waypoints</legend>
                                        <div class="waypoints-container"></div>
                                        <button class="btn btn-secondary btn-sm w-full mt-1 text-xs p-1 add-waypoint-btn">Add Waypoint</button>
                                    </fieldset>
                                </div>
                            </div>
                        </div>`;
                    cardsContainer.innerHTML += controllerHTML;
                });
            
                this.setupGlobalAnimationTrayListeners();
            }

            setupGlobalAnimationTrayListeners() {
                this.animationTray.querySelectorAll('.anim-tray-controller').forEach(controller => {
                    const objectId = controller.dataset.objectId;
                    const obj = this.getPlaygroundObject(objectId);
                    if (!obj) return;
                    const anim = obj.animation;

                    const panels = {
                        'v-mode': controller.querySelector('.v-mode-content'),
                        'p-mode': controller.querySelector('.p-mode-content'),
                        'physics-mode': controller.querySelector('.physics-mode-content')
                    };
                    controller.querySelectorAll('input[type="radio"][name^="panel-toggle-"]').forEach(radio => {
                        radio.addEventListener('change', () => {
                            Object.values(panels).forEach(p => p.classList.add('hidden'));
                            if (panels[radio.value]) panels[radio.value].classList.remove('hidden');
                        });
                        if (radio.checked) radio.dispatchEvent(new Event('change'));
                    });

                    controller.querySelectorAll('.mode-enable-toggle').forEach(checkbox => {
                        checkbox.addEventListener('change', (e) => {
                            anim.modes[e.target.dataset.mode] = e.target.checked;
                            this.plotter.updatePathVisualizer(objectId, anim.modes.physics ? anim.path.waypoints : []);
                        });
                    });
            
                    controller.querySelector('.anim-play-pause')?.addEventListener('click', () => this.toggleAnimation(objectId));
                    controller.querySelector('.anim-reset-btn')?.addEventListener('click', () => this.resetAnimationAndInputs(objectId));
                    const loopBtn = controller.querySelector('.anim-loop-toggle');
                    if (loopBtn) {
                        loopBtn.classList.toggle('active', !!anim.loop);
                        loopBtn.addEventListener('click', () => { anim.loop = !anim.loop; loopBtn.classList.toggle('active', anim.loop); });
                    }
                    const slider = controller.querySelector('.anim-slider');
                    if (slider) {
                        slider.addEventListener('input', () => {
                            anim.T.current = parseFloat(slider.value);
                            if (!anim.isPlaying) { this.replotWithAnimationOverrides(obj); this.applyAdvancedTransforms(obj); }
                        });
                    }
                    const debouncedReplot = this.debounce(() => { if (!anim.isPlaying) this.replotWithAnimationOverrides(obj); }, 500);

                    controller.querySelectorAll('.v-mode-content .anim-controller-range, .v-mode-content .anim-controller-speed, .v-mode-content .anim-easing-select, .v-mode-content .var-toggle, .v-mode-content .anim-var-range').forEach(input => {
                       const eventType = (input.type === 'checkbox' || input.tagName === 'SELECT') ? 'change' : 'input';
                       input.addEventListener(eventType, () => {
                           if (input.classList.contains('var-toggle')) {
                                anim.targetVars[input.dataset.var] = input.checked;
                           } else if (input.classList.contains('anim-var-range')) {
                                anim.varRanges[input.dataset.var][input.dataset.range] = parseFloat(input.value);
                           } else {
                               const val = input.tagName === 'SELECT' ? input.value : parseFloat(input.value);
                               if (input.classList.contains('anim-easing-select')) anim.easing = val;
                               else if (input.classList.contains('anim-controller-speed')) anim.speed = val;
                               else anim.T[input.dataset.range] = val;
                           }
                           if (slider) { slider.min = anim.T.min; slider.max = anim.T.max; }
                           debouncedReplot();
                       });
                    });

                    controller.querySelectorAll('.p-mode-content input[type="text"]').forEach(input => {
                       input.addEventListener('input', () => {
                           anim[input.dataset.type][input.dataset.axis] = input.value;
                           if (!anim.isPlaying) this.applyAdvancedTransforms(obj);
                       });
                    });
                    
                    controller.querySelectorAll('.physics-mode-content input, .physics-mode-content .path-auto-rotate').forEach(input => {
                        const event = input.type === 'checkbox' ? 'change' : 'input';
                        input.addEventListener(event, e => {
                            if (e.target.classList.contains('path-auto-rotate')) anim.path.autoRotate = e.target.checked;
                            const prop = e.target.dataset.prop;
                            if(prop) anim.path.physics[prop] = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
                        });
                    });
                    controller.querySelector('.add-waypoint-btn')?.addEventListener('click', () => {
                        anim.path.waypoints.push({x:0, y:0, z:0});
                        this.renderWaypoints(objectId);
                    });
                    this.renderWaypoints(objectId);
                });
            }

            renderWaypoints(objectId) {
                const obj = this.getPlaygroundObject(objectId);
                if (!obj || !obj.animation) return;
                const container = this.animationTray.querySelector(`.anim-tray-controller[data-object-id="${objectId}"] .waypoints-container`);
                if (!container) return;
                
                container.innerHTML = '';
                obj.animation.path.waypoints.forEach((wp, index) => {
                    const item = document.createElement('div');
                    item.className = 'waypoint-item';
                    item.innerHTML = `
                        <input type="number" step="0.1" class="compact-input" data-axis="x" value="${wp.x}">
                        <input type="number" step="0.1" class="compact-input" data-axis="y" value="${wp.y}">
                        <input type="number" step="0.1" class="compact-input" data-axis="z" value="${wp.z}">
                        <button class="icon-btn waypoint-remove-btn hover:bg-red-500/20 hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                    `;
                    container.appendChild(item);

                    item.querySelectorAll('input').forEach(input => {
                        input.addEventListener('input', (e) => {
                            obj.animation.path.waypoints[index][e.target.dataset.axis] = parseFloat(e.target.value) || 0;
                            this.plotter.updatePathVisualizer(objectId, obj.animation.path.waypoints);
                        });
                    });
                    item.querySelector('.waypoint-remove-btn').addEventListener('click', () => {
                        obj.animation.path.waypoints.splice(index, 1);
                        this.renderWaypoints(objectId);
                        this.plotter.updatePathVisualizer(objectId, obj.animation.path.waypoints);
                    });
                });
                this.plotter.updatePathVisualizer(objectId, obj.animation.activeMode === 'physics' ? obj.animation.path.waypoints : []);
            }

            getDefaultAnimationConfig(type) {
                const base = {
                    isPlaying: false, loop: false, lastPlotTimestamp: 0, direction: 1, name: 'T',
                    modes: { v: true, p: false, physics: false },
                    T: { min: 0, max: 10, current: 0 }, speed: 1.0, easing: 'linear',
                    pos: { x: '0', y: '0', z: '0' },
                    rot: { mode: 'euler', x: '0', y: '0', z: '0', ax: '0', ay: '0', az: '1', angle: 'T*90' },
                    scale: { x: '1', y: '1', z: '1' },
                    visibility: 'true',
                    path: {
                        waypoints: [{x:0, y:0, z:0}, {x:5, y:5, z:5}],
                        autoRotate: true,
                        physics: {
                            mass: 1.0,
                            thrust: '100',
                            gravity: 9.8,
                            drag: 0.1,
                            _velocity: new THREE.Vector3(),
                            _previousPosition: null,
                            _currentWaypoint: 0,
                            _position: new THREE.Vector3(),
                            _quaternion: new THREE.Quaternion()
                        }
                    }
                };
                switch(type) {
                    case 'surface': return {...base, T: { min: -5, max: 5, current: -5 }, targetVars: { x: false, y: false }, varRanges: { x: { min: -5, max: 5 }, y: { min: -5, max: 5 } } };
                    case 'parametric': return {...base, T: { min: 0, max: 6.28, current: 0 }, targetVars: { u: false, v: false }, varRanges: { u: { min: 0, max: 6.28 }, v: { min: 0, max: 6.28 } } };
                    case 'curve': return {...base, T: { min: 0, max: 10, current: 0 }, targetVars: { t: true }, varRanges: { t: { min: 0, max: 10 } } };
                    case 'vector': return {...base, T: { min: -3, max: 3, current: -3 }, targetVars: { x: false, y: false, z: false }, varRanges: { x: { min: -3, max: 3 }, y: { min: -3, max: 3 }, z: { min: -3, max: 3 } } };
                    

                    default: return null;
                }
            }

            updateAnimationValueDisplays(objectId, clear=false) {
                const obj = this.getPlaygroundObject(objectId);
                if (!obj || !obj.animation) return;
                const controller = this.animationTray.querySelector(`.anim-tray-controller[data-object-id="${objectId}"]`);
                if (!controller) return;

                const slider = controller.querySelector('.anim-slider');
                const valueSpan = controller.querySelector('.anim-val');

                slider.value = obj.animation.T.current;
                valueSpan.textContent = obj.animation.T.current.toFixed(2);

                const percent = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
                const accent = getComputedStyle(controller).getPropertyValue('--component-accent');
                slider.style.background = `linear-gradient(to right, ${accent} ${percent}%, var(--bg-input) ${percent}%)`;

                controller.querySelectorAll('.p-mode-live-value').forEach(span => {
                    span.textContent = clear ? '' : span.textContent;
                });
            }

            isAnyAnimationPlaying() {
                return this.playgroundObjects.some(obj => obj.animation && obj.animation.isPlaying);
            }

            updateGlobalPlayPauseButton() {
                const isPlaying = this.isAnyAnimationPlaying();
                this.globalPlayIcon.classList.toggle('hidden', isPlaying);
                this.globalPauseIcon.classList.toggle('hidden', !isPlaying);
                this.globalPlayPauseBtn.classList.toggle('btn-primary', isPlaying);
                this.globalPlayPauseBtn.classList.toggle('btn-secondary', !isPlaying);
            }

            toggleAllAnimations() {
                if (this.isAnyAnimationPlaying()) {
                    this.pauseAllAnimations();
                } else {
                    this.playAllAnimations();
                }
            }
            toggleAllOverrides() {
                
                const overrideCheckboxes = this.animationTray.querySelectorAll('.var-toggle:not(:disabled)');
                if (overrideCheckboxes.length === 0) return;
            
                
                
                
                const shouldCheckAll = Array.from(overrideCheckboxes).some(cb => !cb.checked);
            
                overrideCheckboxes.forEach(checkbox => {
                    if (checkbox.checked !== shouldCheckAll) {
                        checkbox.checked = shouldCheckAll;
                        
                        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            
                this.showToast(shouldCheckAll ? 'All overrides enabled' : 'All overrides disabled');
            }

            playAllAnimations() {
                const animatableObjects = this.playgroundObjects.filter(obj => obj.animation && !obj.animation.isPlaying);
            
                if (animatableObjects.length === 0) {
                    return;
                }
            
                let complexityScore = 0;
                animatableObjects.forEach(obj => {
                    const quality = obj.config?.quality || 100;
            
                    if (obj.type === 'implicit') {
                        complexityScore += 20; // Implicit surfaces are always heavy
                    } else if ((obj.type === 'surface' || obj.type === 'parametric') && quality > 80) {
                        complexityScore += 3; // High-quality surfaces are heavy
                    } else if (obj.type === 'curve' && quality > 1000) {
                        complexityScore += 2; // High-quality curves are moderately heavy
                    } else {
                        complexityScore += 1; // All other objects are standard
                    }
                });
            
                const bufferTimeInSeconds = Math.floor(complexityScore / 3);
                const bufferTimeInMs = bufferTimeInSeconds * 1000;
            
                // --- LOGIC UPDATE ---
                // Only trigger the buffer if the time is > 0 AND there is more than one object.
                if (bufferTimeInMs > 0 && animatableObjects.length > 1) {
                    // --- Buffering Logic ---
                    this.bufferingOverlay.classList.remove('hidden');
                    let countdown = bufferTimeInSeconds;
                    this.bufferingText.textContent = `Syncing animations... ${countdown}s`;
            
                    const countdownInterval = setInterval(() => {
                        countdown--;
                        this.bufferingText.textContent = `Syncing animations... ${countdown}s`;
                        if (countdown <= 0) {
                            clearInterval(countdownInterval);
                        }
                    }, 1000);
            
                    setTimeout(() => {
                        this.bufferingOverlay.classList.add('hidden');
                        animatableObjects.forEach(obj => {
                            this.startAnimation(obj.id);
                        });
                    }, bufferTimeInMs);
            
                } else {
                    // --- No Buffer Needed ---
                    // Play immediately if there's only one object, or if the scene is not complex.
                    animatableObjects.forEach(obj => {
                        this.startAnimation(obj.id);
                    });
                }
            }

            pauseAllAnimations() {
                this.playgroundObjects.forEach(obj => {
                    if (obj.animation && obj.animation.isPlaying) {
                        this.stopAnimation(obj.id);
                    }
                });
            }

            toggleAnimation(objectId) {
                const obj = this.getPlaygroundObject(objectId);
                if (!obj || !obj.animation) return;
                if (obj.animation.isPlaying) this.stopAnimation(objectId);
                else this.startAnimation(objectId);
            }

            resetAnimation(objectId) {
                const obj = this.getPlaygroundObject(objectId);
                if (!obj || !obj.animation) return;
                this.stopAnimation(objectId);
                obj.animation.T.current = obj.animation.T.min;
                obj.animation.direction = 1;
                
                if (obj.animation.modes.physics) {
                    const phys = obj.animation.path.physics;
                    phys._velocity.set(0, 0, 0);
                    phys._previousPosition = null;
                    phys._currentWaypoint = 0;

                    if (obj.threeMesh && obj.animation.path.waypoints.length > 0) {
                        const start = obj.animation.path.waypoints[0];
                        phys._position.set(start.x, start.y, start.z);
                        phys._quaternion.identity();
                        obj.threeMesh.position.copy(phys._position);
                        obj.threeMesh.quaternion.copy(phys._quaternion);
                    }
                }
            
                this.updateAnimationValueDisplays(objectId);
            }

            runPhysicsStep(obj, deltaTime) {
                const { path, T } = obj.animation;
                const phys = path.physics;
                const { waypoints, autoRotate } = path;
                
                const defaultTransform = { position: phys._position, quaternion: phys._quaternion };

                if (waypoints.length === 0 || phys._currentWaypoint >= waypoints.length || deltaTime <= 0) {
                    this.stopAnimation(obj.id);
                    return defaultTransform;
                }

                const currentPos = phys._position.clone();
                
                if (phys._previousPosition === null) {
                    phys._previousPosition = currentPos.clone().sub(phys._velocity.clone().multiplyScalar(deltaTime));
                }

                const netForce = new THREE.Vector3(0, 0, 0);
                const targetWp = waypoints[phys._currentWaypoint];
                const targetPos = new THREE.Vector3(targetWp.x, targetWp.y, targetWp.z);
                
                let thrustMag = 0;
                const thrustInput = document.querySelector(`.anim-tray-controller[data-object-id="${obj.id}"] input[data-prop="thrust"]`);
                try {
                    const expr = phys.thrust;
                    if (!this.expressionCache[expr]) {
                        this.expressionCache[expr] = math.parse(expr).compile();
                    }
                    thrustMag = this.expressionCache[expr].evaluate({ T: T.current });
                    if(thrustInput) thrustInput.classList.remove('input-error');
                } catch(e) { 
                    if(thrustInput) thrustInput.classList.add('input-error');
                    this.stopAnimation(obj.id);
                    return defaultTransform;
                }
                
                if (currentPos.distanceTo(targetPos) > 0.1) {
                    const thrustForce = new THREE.Vector3().subVectors(targetPos, currentPos).normalize().multiplyScalar(thrustMag);
                    netForce.add(thrustForce);
                }

                const gravityForce = new THREE.Vector3(0, 0, -phys.gravity * phys.mass);
                netForce.add(gravityForce);

                const dragForce = phys._velocity.clone().multiplyScalar(-phys.drag);
                netForce.add(dragForce);
                
                const acceleration = netForce.divideScalar(phys.mass || 1);
                const displacement = currentPos.clone().sub(phys._previousPosition).add(acceleration.multiplyScalar(deltaTime * deltaTime));
                const newPosition = currentPos.clone().add(displacement);
                
                phys._previousPosition.copy(currentPos);
                phys._velocity.copy(displacement).divideScalar(deltaTime);

                if (currentPos.distanceTo(targetPos) < 1.0 && phys._currentWaypoint < waypoints.length - 1) {
                    phys._currentWaypoint++;
                }

                let newQuaternion = phys._quaternion.clone();
                if (autoRotate && phys._velocity.lengthSq() > 0.001) {
                    const up = new THREE.Vector3(0, 0, 1);
                    const lookAtMatrix = new THREE.Matrix4().lookAt(newPosition, newPosition.clone().add(phys._velocity), up);
                    const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(lookAtMatrix);
                    newQuaternion.slerp(targetQuaternion, 0.1);
                }
                
                phys._position.copy(newPosition);
                phys._quaternion.copy(newQuaternion);
                
                return { position: phys._position, quaternion: phys._quaternion };
            }

            applyAdvancedTransforms(obj, deltaTime = 0.016) {
                if (!obj || !obj.animation || !obj.threeMesh) return;
                const anim = obj.animation;
                const mesh = obj.threeMesh;

                let finalPosition = new THREE.Vector3();
                let finalQuaternion = new THREE.Quaternion();
                let finalScale = new THREE.Vector3(1, 1, 1);

                if (anim.modes.physics) {
                    const physicsResult = this.runPhysicsStep(obj, deltaTime);
                    finalPosition.copy(physicsResult.position);
                    finalQuaternion.copy(physicsResult.quaternion);
                } else {
                    finalPosition.set(0,0,0);
                    finalQuaternion.identity();
                }
                
                if (anim.modes.p) {
                    const scope = { T: anim.T.current, PI: Math.PI, sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, log: Math.log, sqrt: Math.sqrt, abs: Math.abs, sign: Math.sign };
                    
                    const evaluate = (expr, inputElement) => {
                        try {
                            if (!this.expressionCache[expr]) {
                                this.expressionCache[expr] = math.parse(expr).compile();
                            }
                            const result = this.expressionCache[expr].evaluate(scope);
                            if(inputElement) inputElement.classList.remove('input-error');
                            return isFinite(result) ? result : 0;
                        } catch (e) {
                            if(inputElement) inputElement.classList.add('input-error');
                            return 0;
                        }
                    };
                    
                    const controllerSelector = `.anim-tray-controller[data-object-id="${obj.id}"]`;

                    const posX = evaluate(anim.pos.x, document.querySelector(`${controllerSelector} input[data-type="pos"][data-axis="x"]`));
                    const posY = evaluate(anim.pos.y, document.querySelector(`${controllerSelector} input[data-type="pos"][data-axis="y"]`));
                    const posZ = evaluate(anim.pos.z, document.querySelector(`${controllerSelector} input[data-type="pos"][data-axis="z"]`));
                    
                    if (anim.modes.physics) {
                        finalPosition.add(new THREE.Vector3(posX, posY, posZ));
                    } else {
                        finalPosition.set(posX, posY, posZ);
                    }

                    const rotX = evaluate(anim.rot.x, document.querySelector(`${controllerSelector} input[data-type="rot"][data-axis="x"]`));
                    const rotY = evaluate(anim.rot.y, document.querySelector(`${controllerSelector} input[data-type="rot"][data-axis="y"]`));
                    const rotZ = evaluate(anim.rot.z, document.querySelector(`${controllerSelector} input[data-type="rot"][data-axis="z"]`));
                    const pModeEuler = new THREE.Euler(THREE.MathUtils.degToRad(rotX), THREE.MathUtils.degToRad(rotY), THREE.MathUtils.degToRad(rotZ));
                    const pModeQuat = new THREE.Quaternion().setFromEuler(pModeEuler);

                    if (anim.modes.physics) {
                        finalQuaternion.multiply(pModeQuat);
                    } else {
                        finalQuaternion.copy(pModeQuat);
                    }

                    const scaleX = evaluate(anim.scale.x, document.querySelector(`${controllerSelector} input[data-type="scale"][data-axis="x"]`)) || 1;
                    const scaleY = evaluate(anim.scale.y, document.querySelector(`${controllerSelector} input[data-type="scale"][data-axis="y"]`)) || 1;
                    const scaleZ = evaluate(anim.scale.z, document.querySelector(`${controllerSelector} input[data-type="scale"][data-axis="z"]`)) || 1;
                    finalScale.set(scaleX, scaleY, scaleZ);
                }
                
                mesh.position.copy(finalPosition);
                mesh.quaternion.copy(finalQuaternion);
                mesh.scale.copy(finalScale);
            }

            resetAllAnimationsAndInputs() {
                this.playgroundObjects.forEach(obj => {
                    if (obj.animation) {
                        this.resetAnimationAndInputs(obj.id);
                    }
                });
                this.showToast('All animations have been reset.');
            }
            resetAnimationAndInputs(objectId) {
                const obj = this.getPlaygroundObject(objectId);
                if (!obj || !obj.animation) {
                    return;
                }
            
                obj.animation.isPlaying = false;
                
                if (this.globalAnimationFrameId && !this.isAnyAnimationPlaying()) {
                    cancelAnimationFrame(this.globalAnimationFrameId);
                    this.globalAnimationFrameId = null;
                    this.globalLastTimestamp = 0;
                }
                
                const defaultConfig = this.getDefaultAnimationConfig(obj.type);
                
                obj.animation = $.extend(true, {}, defaultConfig, { isPlaying: false });
            
                this.renderGlobalAnimationTray();
                
                this.replotWithAnimationOverrides(obj);
                this.applyAdvancedTransforms(obj);
                
                this.updateGlobalPlayPauseButton();
                this.updateControlledUI(false);
            }

            startAnimation(objectId) {
                const obj = this.getPlaygroundObject(objectId);
                if (!obj || !obj.animation || obj.animation.isPlaying) return;

                if (obj.animation.T.current >= obj.animation.T.max) {
                    this.resetAnimation(objectId);
                }

                if (obj.animation.activeMode === 'physics') {
                    this.resetAnimation(objectId);
                }

                obj.animation.isPlaying = true;
                obj.animation.lastPlotTimestamp = 0;

                const perfPreset = this.animationPerformancePresets[this.currentAnimationPerformance];
                if (obj.config.quality) {
                    obj.originalQuality = obj.config.quality;
                    obj.config.quality = Math.max(20, Math.round(obj.originalQuality * perfPreset.qualityFactor));
                }

                const btn = this.animationTray.querySelector(`.anim-tray-controller[data-object-id="${objectId}"] .anim-play-pause`);
                if(btn) {
                    btn.classList.add('active');
                    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="15" x2="10" y2="9"></line><line x1="14" y1="15" x2="14" y2="9"></line></svg>`;
                }

                if (!this.globalAnimationFrameId) {
                    this.globalAnimationFrameId = requestAnimationFrame((timestamp) => this.globalAnimationLoop(timestamp));
                }
                this.updateControlledUI(true);
                this.updateGlobalPlayPauseButton();
            }

            stopAnimation(objectId) {
                const obj = this.getPlaygroundObject(objectId);
                if (!obj || !obj.animation || !obj.animation.isPlaying) return;

                obj.animation.isPlaying = false;

                if (obj.originalQuality) {
                    obj.config.quality = obj.originalQuality;
                    delete obj.originalQuality;
                }
                
                this.updateAnimationValueDisplays(objectId, true);
                this.replotWithAnimationOverrides(obj, false);

                const btn = this.animationTray.querySelector(`.anim-tray-controller[data-object-id="${objectId}"] .anim-play-pause`);
                 if(btn) {
                    btn.classList.remove('active');
                    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
                }
                this.updateControlledUI(false);
                this.updateGlobalPlayPauseButton();
            }

            stopAllAnimations() { 
                this.playgroundObjects.forEach(obj => { if (obj.animation && obj.animation.isPlaying) this.stopAnimation(obj.id); }); 
                this.updateGlobalPlayPauseButton();
            }

            globalAnimationLoop(now) {
                if (!this.globalLastTimestamp) {
                    this.globalLastTimestamp = now;
                    this.globalAnimationFrameId = requestAnimationFrame((timestamp) => this.globalAnimationLoop(timestamp));
                    return;
                }
                
                const deltaTime = (now - this.globalLastTimestamp) / 1000;
                this.globalLastTimestamp = now;

                if (!this.isAnyAnimationPlaying()) {
                    this.globalAnimationFrameId = null;
                    this.globalLastTimestamp = 0;
                    this.accumulator = 0;
                    this.updateControlledUI(false);
                    this.updateGlobalPlayPauseButton();
                    return;
                }
                
                this.accumulator += Math.min(deltaTime, 0.1);

                while (this.accumulator >= this.FIXED_TIMESTEP) {
                    this.playgroundObjects.forEach(obj => {
                        if (obj.animation && obj.animation.isPlaying) {
                            const anim = obj.animation;
                            anim.T.current += anim.speed * anim.direction * this.FIXED_TIMESTEP;

                            if (anim.T.current >= anim.T.max) {
                                if (anim.loop) anim.T.current = anim.T.min;
                                else {
                                    anim.T.current = anim.T.max;
                                    this.stopAnimation(obj.id);
                                }
                            }
                            if (anim.T.current < anim.T.min) {
                                if (anim.loop) anim.T.current = anim.T.max;
                                else {
                                    anim.T.current = anim.T.min;
                                    this.stopAnimation(obj.id);
                                }
                            }
                            
                            this.updateAnimationValueDisplays(obj.id);
                            
                            if (anim.modes.p || anim.modes.physics) {
                                this.applyAdvancedTransforms(obj, this.FIXED_TIMESTEP);
                            }
                        }
                    });
                    this.accumulator -= this.FIXED_TIMESTEP;
                }

                this.playgroundObjects.forEach(obj => {
                    if (obj.animation && obj.animation.isPlaying && obj.animation.modes.v) {
                        const perfPreset = this.animationPerformancePresets[this.currentAnimationPerformance];
                        if (now - obj.animation.lastPlotTimestamp > perfPreset.throttle) {
                            obj.animation.lastPlotTimestamp = now;
                            this.replotWithAnimationOverrides(obj, true);
                        }
                    }
                });

                this.globalAnimationFrameId = requestAnimationFrame((timestamp) => this.globalAnimationLoop(timestamp));
            }
            updateControlledUI(isAnimating) {
                document.querySelectorAll('.form-input[data-anim-var]').forEach(input => {
                    const varName = input.dataset.animVar;
                    const objectContainer = input.closest('[data-object-id]');
                    if (!objectContainer) return;

                    const objectId = objectContainer.dataset.objectId;
                    const obj = this.getPlaygroundObject(objectId);
                    
                    if (obj && obj.animation && obj.animation.isPlaying && obj.animation.activeMode === 'v-mode' && obj.animation.targetVars[varName]) {
                        input.classList.add('anim-controlled');
                    } else {
                        input.classList.remove('anim-controlled');
                    }
                });
            }

            replotWithAnimationOverrides(obj, isFromAnimation = false) {
                if (!obj || !obj.animation) return;
                const anim = obj.animation;
            
                const T_range = anim.T.max - anim.T.min;
                const T_progress = T_range === 0 ? 1 : (anim.T.current - anim.T.min) / T_range;
            
                const easingFunction = this.Easing[anim.easing] || this.Easing.linear;
                const eased_progress = easingFunction(T_progress);
                
                const animationOptions = {};
                let shouldPlot = false;
            
                for (const varName in anim.targetVars) {
                    if (anim.targetVars[varName]) {
                        shouldPlot = true;
                        const varRange = anim.varRanges[varName];
                        const mappedValue = varRange.min + eased_progress * (varRange.max - varRange.min);
                        animationOptions[`${varName}MaxOverride`] = mappedValue;
                    }
                }
                if (shouldPlot || !isFromAnimation) this.plot(obj.id, animationOptions, isFromAnimation);
            }
            
            getLatestMathExpr(id, baseId) { const field = this.mathFields[baseId + '-' + id]; return this.convertLatexToMathJs(field ? field.latex() : '0'); }

            convertLatexToMathJs(latex) {
                if (!latex) return '';
                let s = latex.replace(/\\cdot/g, '*').replace(/\\left\(/g, '(').replace(/\\right\)/g, ')').replace(/π/g, 'pi').replace(/\{/g, '(').replace(/\}/g, ')');
                const trigFuncs = 'sin|cos|tan|sec|csc|cot|asin|acos|atan|ln|log';
                s = s.replace(new RegExp(`\\\\(${trigFuncs})`, 'g'), '$1');
                for (let i=0; i<5; i++) {
                    s = s.replace(/e\^(\([^)]+\)|[a-zA-Z0-9\.]+)/g, 'exp($1)');
                    s = s.replace(/\\sqrt\(([^)]+)\)/g, 'sqrt($1)');
                    s = s.replace(/\\frac\(([^)]+)\)\(([^)]+)\)/g, '(($1)/($2))');
                 }
                return s;
            }

            plot(id, animationOptions = {}, isFromAnimation = false, isQueuedPlot = false) {
                const obj = this.getPlaygroundObject(id);
                if (!obj) return;
                
                if (obj.type === 'single-vector') {
                    
                    this.plotter.updateSinglePlot(obj, false);
                    this.applyAdvancedTransforms(obj);
                    return;
                }
            
                if (this.isPlotting.has(id) && isFromAnimation) return;
                if (!isFromAnimation) {
                    const card = document.querySelector(`[data-object-id="${id}"]`);
                    card?.classList.add('is-plotting');
                }
                this.isPlotting.add(id);
            
                const scope = { T: obj.animation ? obj.animation.T.current : 0 };
                let params = { id, mode: obj.type, ...obj.config, ...animationOptions, scope };
            
                
                if (obj.type === 'implicit') {
                    params.slicingEnabled = this.slicingEnabledToggle.checked;
                    params.sliceAxes = Array.from(this.sliceAxisCheckboxes)
                                            .filter(cb => cb.checked)
                                            .map(cb => cb.value);
                    params.slicePositions = {
                        x: parseFloat(this.slicePositionSliders.x.value),
                        y: parseFloat(this.slicePositionSliders.y.value),
                        z: parseFloat(this.slicePositionSliders.z.value)
                    };
                }
                
            
                try {
                    switch(obj.type) {
                        case 'surface': params.equation = this.getLatestMathExpr(id, 'eq'); break;
                        case 'vector': params.fx = this.getLatestMathExpr(id, 'vx'); params.fy = this.getLatestMathExpr(id, 'vy'); params.fz = this.getLatestMathExpr(id, 'vz'); break;
                        case 'parametric': params.xExpr = this.getLatestMathExpr(id, 'px'); params.yExpr = this.getLatestMathExpr(id, 'py'); params.zExpr = this.getLatestMathExpr(id, 'pz'); break;
                        case 'curve': params.xExpr = this.getLatestMathExpr(id, 'cx'); params.yExpr = this.getLatestMathExpr(id, 'cy'); params.zExpr = this.getLatestMathExpr(id, 'cz'); break;

                    }
                } catch(e) { this.isPlotting.delete(id); this.showError(e.message, id); this.hideLoading(); return; }
            
                this.worker.postMessage(params);
            }
            updateCoords(text) {
                // Add a check to make sure this.plotter is initialized
                if (this.plotter) {
                    const displayText = text ? text : 'Hover for coordinates...';
                    this.plotter.updateHUDText(displayText);
                }
            }

            showLoading() { this.loadingOverlay.classList.remove('hidden'); setTimeout(() => this.loadingOverlay.style.opacity = '1', 10); this.hideError(); }
            hideLoading() { if (this.isPlotting.size > 0) return; this.loadingOverlay.style.opacity = '0'; setTimeout(() => this.loadingOverlay.classList.add('hidden'), 300); }
            showError(message = "Please check your input.", id) { const errorEl = document.getElementById(`error-${id}`); if (errorEl) { errorEl.textContent = message; errorEl.classList.remove('hidden'); } if (this.isPlotting.size === 0) this.hideLoading(); }
            hideError(id) { if (id) { const errorEl = document.getElementById(`error-${id}`); if (errorEl) errorEl.classList.add('hidden'); } else { document.querySelectorAll('.error-badge').forEach(el => el.classList.add('hidden')); } }
            showToast(message) { this.toastEl.textContent = message; this.toastEl.classList.add('show'); setTimeout(() => { this.toastEl.classList.remove('show'); }, 3000); }

            copyToClipboard(text, message) {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    this.showToast(message);
                } catch (err) {
                    this.showToast('Failed to copy!');
                }
                document.body.removeChild(textArea);
            }

            syncUItoState() {
                this.playgroundObjects.forEach(obj => {
                    const container = document.querySelector(`[data-object-id="${obj.id}"]`);
                    if (!container) return;
                    container.querySelectorAll('input[data-config], select[data-config]').forEach(el => {
                        const key = el.dataset.config;
                        if (key && obj.config.hasOwnProperty(key)) {
                            const value = el.type === 'checkbox' ? el.checked : (el.type === 'color' ? el.value : (el.type === 'number' || el.type === 'range' ? parseFloat(el.value) : el.value));
                            obj.config[key] = value;
                        }
                    });
                    if (obj.type === 'single-vector') return;
                    try {
                        switch(obj.type) {
                            case 'surface': obj.config.equation = this.mathFields[`eq-${obj.id}`]?.latex(); break;
                            case 'parametric': obj.config.xExpr = this.mathFields[`px-${obj.id}`]?.latex(); obj.config.yExpr = this.mathFields[`py-${obj.id}`]?.latex(); obj.config.zExpr = this.mathFields[`pz-${obj.id}`]?.latex(); break;
                            case 'curve': obj.config.xExpr = this.mathFields[`cx-${obj.id}`]?.latex(); obj.config.yExpr = this.mathFields[`cy-${obj.id}`]?.latex(); obj.config.zExpr = this.mathFields[`cz-${obj.id}`]?.latex(); break;
                            case 'vector': obj.config.fx = this.mathFields[`vx-${obj.id}`]?.latex(); obj.config.fy = this.mathFields[`vy-${obj.id}`]?.latex(); obj.config.fz = this.mathFields[`vz-${obj.id}`]?.latex(); break;
 
                        }
                    } catch(e) { this.showToast("Could not sync MathField state"); }
                });
            }

            collectSettings() {
                const statesToSave = JSON.parse(JSON.stringify(this.modeStates));
                statesToSave[this.currentMode] = this.playgroundObjects;

                for (const mode in statesToSave) {
                    statesToSave[mode].forEach(obj => {
                        delete obj.lastData;
                        delete obj.threeMesh;
                        if (obj.animation) {
                             delete obj.animation.lastPlotTimestamp;
                             delete obj.animation.isPlaying;
                             delete obj.animation.direction;
                        }
                    });
                }
                const settings = {
                    version: 'threejs-3.0-path-animation',
                    mode: this.currentMode,
                    focusedObjectId: this.focusedObjectId,
                    modeStates: statesToSave,
                    animationPerformance: this.currentAnimationPerformance
                };
                return settings;
            }
            shareState() {
                try {
                    const settings = this.collectSettings();
                    const jsonString = JSON.stringify(settings);
                    const compressed = pako.deflate(jsonString, { to: 'string' });
                    const encoded = btoa(compressed);
                    const url = `${window.location.origin}${window.location.pathname}?s=${encodeURIComponent(encoded)}`;
                    this.copyToClipboard(url, 'Sharable link copied to clipboard!');
                } catch (e) { this.showToast('Error creating share link.'); }
            }

            saveSettings() {
                try {
                    const settings = this.collectSettings();
                    const jsonString = JSON.stringify(settings, null, 2);
                    const blob = new Blob([jsonString], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'plotter-pro-settings.json';
                    a.click();
                    URL.revokeObjectURL(url);
                    this.showToast('Settings saved!');
                } catch(e) { this.showToast('Error saving settings.'); }
            }

            exportSTL() {
                const exporter = new THREE.STLExporter();
                let objectToExport = null;
                let objectName = 'plot';

                if (this.currentMode === 'playground') {
                    if (!this.focusedObjectId) {
                        this.showToast('Please focus an object to export.');
                        return;
                    }
                    const obj = this.getPlaygroundObject(this.focusedObjectId);
                    if (obj && obj.threeMesh) {
                        objectToExport = obj.threeMesh;
                        objectName = obj.name;
                    }
                } else {
                    const obj = this.playgroundObjects[0];
                    if (obj && obj.threeMesh) {
                        objectToExport = obj.threeMesh;
                        objectName = obj.name;
                    }
                }

                if (!objectToExport) {
                    this.showToast('No valid object selected for export.');
                    return;
                }

                try {
                    const stlString = exporter.parse(objectToExport);
                    const blob = new Blob([stlString], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${objectName.replace(/ /g, '_')}.stl`;
                    a.click();
                    URL.revokeObjectURL(url);
                    this.showToast('STL file exported!');
                } catch (e) {
                    this.showToast('Error exporting STL file.');
                }
            }

            exportGLTF() {
                const exporter = new THREE.GLTFExporter();
                let objectToExport = null;
                let objectName = 'plot';

                if (this.currentMode === 'playground') {
                    if (!this.focusedObjectId) { this.showToast('Please focus an object to export.'); return; }
                    const obj = this.getPlaygroundObject(this.focusedObjectId);
                    if (obj && obj.threeMesh) { objectToExport = obj.threeMesh; objectName = obj.name; }
                } else {
                    const obj = this.playgroundObjects[0];
                    if (obj && obj.threeMesh) { objectToExport = obj.threeMesh; objectName = obj.name; }
                }

                if (!objectToExport) { this.showToast('No valid object selected for export.'); return; }

                exporter.parse(objectToExport, (gltf) => {
                    const output = JSON.stringify(gltf, null, 2);
                    const blob = new Blob([output], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${objectName.replace(/ /g, '_')}.gltf`;
                    a.click();
                    URL.revokeObjectURL(url);
                    this.showToast('GLTF file exported!');
                }, (error) => {
                    this.showToast('Error exporting GLTF file.');
                });
            }

            loadStateFromURL() {
                const urlParams = new URLSearchParams(window.location.search);
                const stateParam = urlParams.get('s');
                if (stateParam) {
                    try {
                        const decoded = atob(decodeURIComponent(stateParam));
                        const decompressed = pako.inflate(decoded, { to: 'string' });
                        const settings = JSON.parse(decompressed);
                        this.applySettings(settings);
                        return true;
                    } catch (e) { this.showToast('Error loading shared link.'); return false; }
                }
                return false;
            }

            loadSettings(event) {
                const file = event.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const settings = JSON.parse(e.target.result);
                        this.applySettings(settings);
                        this.showToast('Settings loaded!');
                    } catch (err) { this.showToast('Error: Invalid settings file.'); }
                };
                reader.readAsText(file);
                event.target.value = '';
            }

            applySettings(settings) {
                this.stopAllAnimations();
                if (settings.animationPerformance && this.animationPerformancePresets[settings.animationPerformance]) {
                    this.currentAnimationPerformance = settings.animationPerformance;
                }
                this.modeStates = settings.modeStates || { playground: [], surface: [], parametric: [], curve: [], vector: [] };
                 for (const mode in this.modeStates) {
                    this.modeStates[mode].forEach(obj => {
                        const defaultConfig = this.getDefaultConfig(obj.type);
                        if (obj.config) {
                            obj.config = { ...defaultConfig, ...obj.config };
                        } else {
                            obj.config = defaultConfig;
                        }
            
                        const baseAnimState = this.getDefaultAnimationConfig(obj.type);
                        if (baseAnimState) {
                             if (obj.animation) {
                                obj.animation = $.extend(true, {}, baseAnimState, obj.animation);
                             } else {
                                obj.animation = baseAnimState;
                             }
                        }
                    });
                }
                this.focusedObjectId = settings.focusedObjectId || null;
                this.switchMode(settings.mode || 'playground', true);
            }

            initializeCalculator() {
                this.calculatorPopup = document.getElementById('calculator-popup');
                this.calculatorKeypad = document.getElementById('calculator-keypad');
                this.calculatorCloseBtn = document.getElementById('calculator-close-btn');
                this.calculatorDoneBtn = document.getElementById('calculator-done-btn');
                this.calculatorDragHandle = document.getElementById('calculator-drag-handle');
                this.activeCalculatorFieldId = null;

                const MQ = MathQuill.getInterface(2);
                const calculatorDisplayMQ = document.getElementById('calculator-display-mq');
                this.calculatorMathField = MQ.MathField(calculatorDisplayMQ, {
                    spaceBehavesLikeTab: true,
                    handlers: {
                        edit: () => {
                            if (this.activeCalculatorFieldId && this.mathFields[this.activeCalculatorFieldId]) {
                                const sourceField = this.mathFields[this.activeCalculatorFieldId];
                                sourceField.latex(this.calculatorMathField.latex());
                            }
                        }
                    }
                });

                const keys = [
                    { t: 'sin', v: '\\sin', c: 'fn-key' }, { t: 'cos', v: '\\cos', c: 'fn-key' }, { t: 'tan', v: '\\tan', c: 'fn-key' }, { t: 'π', v: '\\pi' }, { t: 'e', v: 'e' },
                    { t: '(', v: '(' }, { t: ')', v: ')' }, { t: '√', v: '\\sqrt', c: 'fn-key' }, { t: 'x²', v: '^2' }, { t: 'xʸ', v: '^' },
                    { t: '7', v: '7' }, { t: '8', v: '8' }, { t: '9', v: '9' }, { t: '÷', v: '/', c: 'op-key' }, { t: '⌫', v: 'Backspace', c: 'op-key' },
                    { t: '4', v: '4' }, { t: '5', v: '5' }, { t: '6', v: '6' }, { t: '×', v: '\\cdot', c: 'op-key' }, { t: 'T', v: 'T' },
                    { t: '1', v: '1' }, { t: '2', v: '2' }, { t: '3', v: '3' }, { t: '−', v: '-', c: 'op-key' }, { t: 'u', v: 'u' },
                    { t: '0', v: '0' }, { t: '.', v: '.' }, { t: 'x', v: 'x' }, { t: '+', v: '+', c: 'op-key' }, { t: 'v', v: 'v' }
                ];

                this.calculatorKeypad.innerHTML = keys.map(k => `<button class="${k.c || ''}" data-value="${k.v}">${k.t}</button>`).join('');

                this.calculatorKeypad.addEventListener('click', e => {
                    if (e.target.tagName === 'BUTTON') {
                        const value = e.target.dataset.value;
                        if (value === 'Backspace') {
                            this.calculatorMathField.keystroke('Backspace');
                        } else if (['\\sin', '\\cos', '\\tan', '\\sqrt', '\\cdot', '/', '^'].includes(value)) {
                            this.calculatorMathField.cmd(value);
                        } else {
                            this.calculatorMathField.write(value);
                        }
                        this.calculatorMathField.focus();
                    }
                });

                this.calculatorCloseBtn.addEventListener('click', () => this.closeCalculator());
                this.calculatorDoneBtn.addEventListener('click', () => this.closeCalculator());

                let isDragging = false, offsetX, offsetY;
                this.calculatorDragHandle.addEventListener('mousedown', e => {
                    isDragging = true;
                    offsetX = e.clientX - this.calculatorPopup.offsetLeft;
                    offsetY = e.clientY - this.calculatorPopup.offsetTop;
                    this.calculatorPopup.style.transition = 'none';
                });
                document.addEventListener('mousemove', e => {
                    if (isDragging) {
                        this.calculatorPopup.style.left = `${e.clientX - offsetX}px`;
                        this.calculatorPopup.style.top = `${e.clientY - offsetY}px`;
                    }
                });
                document.addEventListener('mouseup', () => {
                    isDragging = false;
                    this.calculatorPopup.style.transition = '';
                });
            }

            openCalculator(fieldId, triggerBtn) {
                this.activeCalculatorFieldId = fieldId;
                const sourceField = this.mathFields[fieldId];
                if (!sourceField) return;

                this.calculatorMathField.latex(sourceField.latex());

                this.calculatorPopup.classList.remove('hidden');

                const rect = triggerBtn.getBoundingClientRect();
                this.calculatorPopup.style.top = `${rect.bottom + 10}px`;
                this.calculatorPopup.style.left = `${rect.left - this.calculatorPopup.offsetWidth / 2 + rect.width / 2}px`;
                
                setTimeout(() => this.calculatorMathField.focus(), 0);
            }

            closeCalculator() {
                this.calculatorPopup.classList.add('hidden');
                if (this.activeCalculatorFieldId && this.mathFields[this.activeCalculatorFieldId]) {
                    this.mathFields[this.activeCalculatorFieldId].focus();
                }
                this.activeCalculatorFieldId = null;
            }

            navigateToLinearAlgebra() {
                // Show loading overlay
                const overlay = document.getElementById('linear-algebra-overlay');
                overlay.style.display = 'flex';
                
                // Simulate loading time and then navigate
                setTimeout(() => {
                    window.location.href = './Linear_Algebra/index.html';
                }, 2000);
            }

            destroyMathFields(container) {      
                container.querySelectorAll('.mq-initialized').forEach(span => {
                    const id = span.id;
                    if (this.mathFields && this.mathFields[id]) {
                        this.mathFields[id].revert();
                        delete this.mathFields[id];
                        if (this.mathFieldHistory) delete this.mathFieldHistory[id];
                        if (this.mathFieldHistoryPointer) delete this.mathFieldHistoryPointer[id];
                    }
                });
            }
        }

        document.addEventListener('DOMContentLoaded', () => { window.app = new AppController(); });
    