// BlockCraft - Main Game Engine
// Minecraft-Style Web Game

class BlockCraft {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.world = null;
        this.player = null;
        this.inventory = null;
        this.crafting = null;
        this.audio = null;
        
        this.gameState = 'loading';
        this.selectedHotbarSlot = 8;
        this.fps = 0;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        
        this.keys = {};
        this.mouse = { x: 0, y: 0, locked: false };
        this.raycaster = new THREE.Raycaster();
        
        this.init();
    }

    async init() {
        try {
            await this.initLoadingScreen();
            await this.initThreeJS();
            await this.initGameSystems();
            await this.initEventListeners();
            await this.startGame();
        } catch (error) {
            console.error('Failed to initialize game:', error);
            this.showError('Failed to load game. Please refresh the page.');
        }
    }

    async initLoadingScreen() {
        const loadingText = document.getElementById('loadingText');
        const loadingBar = document.getElementById('loadingBar');
        
        const updateLoadingProgress = (text, progress) => {
            loadingText.textContent = text;
            loadingBar.style.width = `${progress}%`;
        };

        // Animate loading title
        const typed = new Typed('#loadingTitle', {
            strings: ['BlockCraft', 'Mining Simulator', 'World Builder', 'BlockCraft'],
            typeSpeed: 100,
            backSpeed: 50,
            loop: false,
            showCursor: false
        });

        // Simulate loading phases
        updateLoadingProgress('Initializing WebGL...', 10);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        updateLoadingProgress('Generating world...', 30);
        await new Promise(resolve => setTimeout(resolve, 800));
        
        updateLoadingProgress('Loading textures...', 60);
        await new Promise(resolve => setTimeout(resolve, 600));
        
        updateLoadingProgress('Finalizing systems...', 90);
        await new Promise(resolve => setTimeout(resolve, 400));
        
        updateLoadingProgress('Ready to play!', 100);
    }

    async initThreeJS() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 500);

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 10, 5);

        // Renderer setup
        const canvas = document.getElementById('gameCanvas');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            antialias: true,
            alpha: false 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x87CEEB);

        // Lighting
        this.setupLighting();
        
        // Initialize world
        await this.initWorld();
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        this.scene.add(directionalLight);

        // Point light for player
        const playerLight = new THREE.PointLight(0xffffff, 0.3, 20);
        playerLight.position.set(0, 2, 0);
        this.scene.add(playerLight);
    }

    async initWorld() {
        // Initialize world generation system
        this.world = new WorldGenerator(this.scene);
        await this.world.generateInitialChunks();
    }

    async initGameSystems() {
        // Initialize player
        this.player = new PlayerController(this.camera, this.scene);
        
        // Initialize inventory
        this.inventory = new InventorySystem();
        
        // Initialize crafting
        this.crafting = new CraftingSystem();
        
        // Initialize audio
        this.audio = new AudioManager();
        
        // Initialize block system
        this.blockSystem = new BlockSystem();
    }

    async initEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Mouse events
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // Pointer lock
        document.addEventListener('pointerlockchange', () => this.handlePointerLockChange());
        document.addEventListener('mozpointerlockchange', () => this.handlePointerLockChange());
        document.addEventListener('webkitpointerlockchange', () => this.handlePointerLockChange());
        
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
        
        // Context menu
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    handleKeyDown(event) {
        this.keys[event.code] = true;
        
        switch(event.code) {
            case 'KeyE':
                event.preventDefault();
                this.toggleInventory();
                break;
            case 'Escape':
                this.toggleMenu();
                break;
            case 'Digit1':
            case 'Digit2':
            case 'Digit3':
            case 'Digit4':
            case 'Digit5':
            case 'Digit6':
            case 'Digit7':
            case 'Digit8':
            case 'Digit9':
                this.selectHotbarSlot(parseInt(event.code.slice(-1)) - 1);
                break;
        }
    }

    handleKeyUp(event) {
        this.keys[event.code] = false;
    }

    handleMouseMove(event) {
        if (this.mouse.locked) {
            this.player.rotateCamera(event.movementX, event.movementY);
        }
    }

    handleMouseDown(event) {
        if (!this.mouse.locked) {
            this.requestPointerLock();
            return;
        }
        
        switch(event.button) {
            case 0: // Left click
                this.mineBlock();
                break;
            case 2: // Right click
                this.placeBlock();
                break;
        }
    }

    handleMouseUp(event) {
        // Handle mouse button release
    }

    requestPointerLock() {
        const canvas = document.getElementById('gameCanvas');
        canvas.requestPointerLock();
    }

    handlePointerLockChange() {
        this.mouse.locked = document.pointerLockElement === document.getElementById('gameCanvas');
    }

    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    selectHotbarSlot(slot) {
        this.selectedHotbarSlot = slot;
        this.updateHotbarUI();
    }

    updateHotbarUI() {
        const slots = document.querySelectorAll('.hotbar-slot');
        slots.forEach((slot, index) => {
            slot.classList.toggle('selected', index === this.selectedHotbarSlot);
        });
    }

    mineBlock() {
        const intersect = this.getBlockIntersection();
        if (intersect) {
            const blockPos = intersect.point.add(intersect.face.normal.multiplyScalar(-0.5));
            const blockCoords = {
                x: Math.floor(blockPos.x),
                y: Math.floor(blockPos.y),
                z: Math.floor(blockPos.z)
            };
            
            // Remove block from world
            this.world.removeBlock(blockCoords.x, blockCoords.y, blockCoords.z);
            
            // Add to inventory
            const blockType = this.world.getBlockType(blockCoords.x, blockCoords.y, blockCoords.z);
            this.inventory.addItem(blockType, 1);
            
            // Play sound
            this.audio.playSound3D('block_break', blockCoords);
            
            // Update UI
            this.updateInventoryUI();
        }
    }

    placeBlock() {
        const intersect = this.getBlockIntersection();
        if (intersect) {
            const placePos = intersect.point.add(intersect.face.normal.multiplyScalar(0.5));
            const blockCoords = {
                x: Math.floor(placePos.x),
                y: Math.floor(placePos.y),
                z: Math.floor(placePos.z)
            };
            
            // Check if player has blocks in inventory
            const selectedItem = this.inventory.getSelectedItem(this.selectedHotbarSlot);
            if (selectedItem && selectedItem.count > 0) {
                // Place block in world
                this.world.placeBlock(blockCoords.x, blockCoords.y, blockCoords.z, selectedItem.type);
                
                // Remove from inventory
                this.inventory.removeItem(selectedItem.type, 1);
                
                // Play sound
                this.audio.playSound3D('block_place', blockCoords);
                
                // Update UI
                this.updateInventoryUI();
            }
        }
    }

    getBlockIntersection() {
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = this.raycaster.intersectObjects(this.world.getBlockMeshes());
        return intersects.length > 0 ? intersects[0] : null;
    }

    toggleInventory() {
        const inventoryPanel = document.getElementById('inventoryPanel');
        const isVisible = inventoryPanel.style.display !== 'none';
        inventoryPanel.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            this.renderInventory();
        }
    }

    toggleMenu() {
        // Implement menu toggle
        console.log('Menu toggled');
    }

    renderInventory() {
        const inventoryPanel = document.getElementById('inventoryPanel');
        inventoryPanel.innerHTML = `
            <div style="padding: 20px; color: white;">
                <h3 style="margin-bottom: 15px;">Inventory</h3>
                <div id="inventoryGrid" style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px;">
                    ${this.inventory.renderGrid()}
                </div>
            </div>
        `;
    }

    updateInventoryUI() {
        // Update hotbar item counts
        const slots = document.querySelectorAll('.hotbar-slot');
        slots.forEach((slot, index) => {
            const item = this.inventory.getSelectedItem(index);
            const countElement = slot.querySelector('.hotbar-item-count');
            countElement.textContent = item ? item.count : 0;
        });
    }

    updateCoordinates() {
        const coords = document.getElementById('coordinates');
        const pos = this.camera.position;
        coords.textContent = `X: ${Math.floor(pos.x)} Y: ${Math.floor(pos.y)} Z: ${Math.floor(pos.z)}`;
    }

    updateFPS() {
        this.frameCount++;
        const currentTime = performance.now();
        
        if (currentTime - this.lastFrameTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFrameTime));
            document.getElementById('fpsCounter').textContent = `FPS: ${this.fps}`;
            this.frameCount = 0;
            this.lastFrameTime = currentTime;
        }
    }

    startGame() {
        // Hide loading screen
        const loadingScreen = document.getElementById('loadingScreen');
        anime({
            targets: loadingScreen,
            opacity: 0,
            duration: 1000,
            easing: 'easeOutQuad',
            complete: () => {
                loadingScreen.style.display = 'none';
                this.gameState = 'playing';
                this.gameLoop();
            }
        });
    }

    gameLoop() {
        if (this.gameState !== 'playing') return;
        
        requestAnimationFrame(() => this.gameLoop());
        
        // Update game systems
        this.player.update(this.keys);
        this.world.updateChunks(this.camera.position);
        this.updateCoordinates();
        this.updateFPS();
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    showError(message) {
        const loadingScreen = document.getElementById('loadingScreen');
        const loadingText = document.getElementById('loadingText');
        loadingText.textContent = message;
        loadingText.style.color = '#E74C3C';
    }
}

// World Generation System
class WorldGenerator {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map();
        this.chunkSize = 16;
        this.renderDistance = 8;
        this.blockGeometry = new THREE.BoxGeometry(1, 1, 1);
        this.blockMaterials = this.createBlockMaterials();
    }

    createBlockMaterials() {
        return {
            grass: new THREE.MeshLambertMaterial({ color: 0x4CAF50 }),
            dirt: new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
            stone: new THREE.MeshLambertMaterial({ color: 0x808080 }),
            wood: new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
            leaves: new THREE.MeshLambertMaterial({ color: 0x228B22, transparent: true, opacity: 0.8 }),
            coal: new THREE.MeshLambertMaterial({ color: 0x2C2C2C }),
            iron: new THREE.MeshLambertMaterial({ color: 0xC0C0C0 }),
            gold: new THREE.MeshLambertMaterial({ color: 0xFFD700 }),
            diamond: new THREE.MeshLambertMaterial({ color: 0x00FFFF })
        };
    }

    async generateInitialChunks() {
        const playerChunkX = 0;
        const playerChunkZ = 0;
        
        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                const chunkX = playerChunkX + x;
                const chunkZ = playerChunkZ + z;
                await this.generateChunk(chunkX, chunkZ);
            }
        }
    }

    async generateChunk(chunkX, chunkZ) {
        const chunkKey = `${chunkX},${chunkZ}`;
        if (this.chunks.has(chunkKey)) return;

        const blocks = [];
        const worldX = chunkX * this.chunkSize;
        const worldZ = chunkZ * this.chunkSize;

        // Generate terrain height map
        for (let x = 0; x < this.chunkSize; x++) {
            for (let z = 0; z < this.chunkSize; z++) {
                const worldPosX = worldX + x;
                const worldPosZ = worldZ + z;
                
                // Simple height map generation
                const height = this.getHeight(worldPosX, worldPosZ);
                
                // Generate terrain layers
                for (let y = 0; y <= height; y++) {
                    const blockType = this.getBlockType(worldPosX, y, worldPosZ, height);
                    if (blockType) {
                        blocks.push({
                            x: worldPosX,
                            y: y,
                            z: worldPosZ,
                            type: blockType
                        });
                    }
                }
                
                // Generate trees
                if (Math.random() < 0.02) {
                    this.generateTree(worldPosX, height + 1, worldPosZ, blocks);
                }
            }
        }

        // Create chunk mesh
        const chunkMesh = this.createChunkMesh(blocks);
        this.chunks.set(chunkKey, { blocks, mesh: chunkMesh });
        this.scene.add(chunkMesh);
    }

    getHeight(x, z) {
        // Simple noise-based height generation
        const scale = 0.01;
        return Math.floor(
            (Math.sin(x * scale) + Math.sin(z * scale)) * 10 +
            (Math.sin(x * scale * 2) + Math.sin(z * scale * 2)) * 5 +
            20
        );
    }

    getBlockType(x, y, z, height) {
        if (y > height) return null;
        if (y === height) return 'grass';
        if (y > height - 3) return 'dirt';
        
        // Ore generation
        if (y < 15) {
            const oreChance = Math.random();
            if (oreChance < 0.01) return 'diamond';
            if (oreChance < 0.05) return 'gold';
            if (oreChance < 0.15) return 'iron';
            if (oreChance < 0.25) return 'coal';
        }
        
        return 'stone';
    }

    generateTree(x, y, z, blocks) {
        const treeHeight = 4 + Math.floor(Math.random() * 3);
        
        // Trunk
        for (let i = 0; i < treeHeight; i++) {
            blocks.push({ x, y: y + i, z, type: 'wood' });
        }
        
        // Leaves
        const leafY = y + treeHeight - 2;
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                for (let dy = 0; dy <= 2; dy++) {
                    if (Math.random() > 0.3) {
                        blocks.push({
                            x: x + dx,
                            y: leafY + dy,
                            z: z + dz,
                            type: 'leaves'
                        });
                    }
                }
            }
        }
    }

    createChunkMesh(blocks) {
        const group = new THREE.Group();
        
        blocks.forEach(block => {
            const mesh = new THREE.Mesh(this.blockGeometry, this.blockMaterials[block.type]);
            mesh.position.set(block.x, block.y, block.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = { 
                blockType: block.type,
                worldX: block.x,
                worldY: block.y,
                worldZ: block.z
            };
            group.add(mesh);
        });
        
        return group;
    }

    removeBlock(x, y, z) {
        const chunkX = Math.floor(x / this.chunkSize);
        const chunkZ = Math.floor(z / this.chunkSize);
        const chunkKey = `${chunkX},${chunkZ}`;
        
        const chunk = this.chunks.get(chunkKey);
        if (!chunk) return;
        
        // Find and remove block mesh
        const meshToRemove = chunk.mesh.children.find(mesh => 
            mesh.userData.worldX === x && 
            mesh.userData.worldY === y && 
            mesh.userData.worldZ === z
        );
        
        if (meshToRemove) {
            chunk.mesh.remove(meshToRemove);
            
            // Update block data
            const blockIndex = chunk.blocks.findIndex(block => 
                block.x === x && block.y === y && block.z === z
            );
            if (blockIndex !== -1) {
                chunk.blocks.splice(blockIndex, 1);
            }
        }
    }

    placeBlock(x, y, z, blockType) {
        const chunkX = Math.floor(x / this.chunkSize);
        const chunkZ = Math.floor(z / this.chunkSize);
        const chunkKey = `${chunkX},${chunkZ}`;
        
        const chunk = this.chunks.get(chunkKey);
        if (!chunk) return;
        
        // Create new block mesh
        const mesh = new THREE.Mesh(this.blockGeometry, this.blockMaterials[blockType]);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { 
            blockType: blockType,
            worldX: x,
            worldY: y,
            worldZ: z
        };
        
        chunk.mesh.add(mesh);
        
        // Add to block data
        chunk.blocks.push({ x, y, z, type: blockType });
    }

    getBlockType(x, y, z) {
        const chunkX = Math.floor(x / this.chunkSize);
        const chunkZ = Math.floor(z / this.chunkSize);
        const chunkKey = `${chunkX},${chunkZ}`;
        
        const chunk = this.chunks.get(chunkKey);
        if (!chunk) return null;
        
        const block = chunk.blocks.find(b => b.x === x && b.y === y && b.z === z);
        return block ? block.type : null;
    }

    getBlockMeshes() {
        const meshes = [];
        this.chunks.forEach(chunk => {
            meshes.push(...chunk.mesh.children);
        });
        return meshes;
    }

    updateChunks(playerPosition) {
        const playerChunkX = Math.floor(playerPosition.x / this.chunkSize);
        const playerChunkZ = Math.floor(playerPosition.z / this.chunkSize);
        
        // Generate new chunks if needed
        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                const chunkX = playerChunkX + x;
                const chunkZ = playerChunkZ + z;
                this.generateChunk(chunkX, chunkZ);
            }
        }
    }
}

// Player Controller
class PlayerController {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.position = camera.position;
        this.velocity = new THREE.Vector3();
        this.speed = 0.1;
        this.jumpForce = 0.15;
        this.gravity = -0.01;
        this.grounded = false;
        
        this.pitch = 0;
        this.yaw = 0;
    }

    rotateCamera(movementX, movementY) {
        this.yaw -= movementX * 0.002;
        this.pitch -= movementY * 0.002;
        this.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.pitch));
        
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.yaw;
        this.camera.rotation.x = this.pitch;
    }

    update(keys) {
        // Handle movement
        const direction = new THREE.Vector3();
        
        if (keys['KeyW']) direction.z -= 1;
        if (keys['KeyS']) direction.z += 1;
        if (keys['KeyA']) direction.x -= 1;
        if (keys['KeyD']) direction.x += 1;
        
        if (direction.length() > 0) {
            direction.normalize();
            direction.multiplyScalar(this.speed);
            
            // Rotate movement direction based on camera orientation
            const forward = new THREE.Vector3(0, 0, -1);
            const right = new THREE.Vector3(1, 0, 0);
            forward.applyQuaternion(this.camera.quaternion);
            right.applyQuaternion(this.camera.quaternion);
            forward.y = 0;
            right.y = 0;
            forward.normalize();
            right.normalize();
            
            this.velocity.x = (forward.x * direction.z + right.x * direction.x);
            this.velocity.z = (forward.z * direction.z + right.z * direction.x);
        } else {
            this.velocity.x *= 0.8;
            this.velocity.z *= 0.8;
        }
        
        // Jumping
        if (keys['Space'] && this.grounded) {
            this.velocity.y = this.jumpForce;
        }
        
        // Gravity
        this.velocity.y += this.gravity;
        
        // Update position
        this.position.add(this.velocity);
        
        // Simple ground collision
        if (this.position.y < 10) {
            this.position.y = 10;
            this.velocity.y = 0;
            this.grounded = true;
        } else {
            this.grounded = false;
        }
    }
}

// Inventory System
class InventorySystem {
    constructor() {
        this.items = new Map();
        this.maxStackSize = 64;
        this.hotbarSize = 9;
    }

    addItem(type, count = 1) {
        if (this.items.has(type)) {
            const current = this.items.get(type);
            const newCount = Math.min(current + count, this.maxStackSize);
            this.items.set(type, newCount);
            return newCount - current;
        } else {
            this.items.set(type, Math.min(count, this.maxStackSize));
            return Math.min(count, this.maxStackSize);
        }
    }

    removeItem(type, count = 1) {
        if (this.items.has(type)) {
            const current = this.items.get(type);
            const newCount = Math.max(0, current - count);
            if (newCount === 0) {
                this.items.delete(type);
            } else {
                this.items.set(type, newCount);
            }
            return true;
        }
        return false;
    }

    getItemCount(type) {
        return this.items.get(type) || 0;
    }

    getSelectedItem(slot) {
        const itemTypes = Array.from(this.items.keys());
        if (slot < itemTypes.length) {
            const type = itemTypes[slot];
            return { type, count: this.items.get(type) };
        }
        return null;
    }

    renderGrid() {
        let html = '';
        const itemTypes = Array.from(this.items.keys());
        
        for (let i = 0; i < 27; i++) { // 3x9 inventory grid
            const type = itemTypes[i];
            const count = type ? this.items.get(type) : 0;
            
            html += `
                <div class="inventory-slot" style="
                    width: 40px; 
                    height: 40px; 
                    background: rgba(255,255,255,0.1); 
                    border: 1px solid rgba(255,255,255,0.2);
                    display: flex; 
                    align-items: center; 
                    justify-content: center;
                    position: relative;
                ">
                    ${type ? `<span style="color: white; font-size: 0.8rem;">${type}</span>` : ''}
                    ${count > 0 ? `<span style="position: absolute; bottom: 2px; right: 2px; font-size: 0.7rem; color: white;">${count}</span>` : ''}
                </div>
            `;
        }
        
        return html;
    }
}

// Crafting System
class CraftingSystem {
    constructor() {
        this.recipes = this.initializeRecipes();
    }

    initializeRecipes() {
        return {
            'wooden_planks': {
                ingredients: { 'wood': 1 },
                result: { type: 'wooden_planks', count: 4 }
            },
            'crafting_table': {
                ingredients: { 'wooden_planks': 4 },
                result: { type: 'crafting_table', count: 1 }
            },
            'wooden_pickaxe': {
                ingredients: { 'wooden_planks': 3, 'stick': 2 },
                result: { type: 'wooden_pickaxe', count: 1 }
            }
        };
    }

    canCraft(recipeName, inventory) {
        const recipe = this.recipes[recipeName];
        if (!recipe) return false;
        
        for (const [ingredient, count] of Object.entries(recipe.ingredients)) {
            if (inventory.getItemCount(ingredient) < count) {
                return false;
            }
        }
        return true;
    }

    craft(recipeName, inventory) {
        if (!this.canCraft(recipeName, inventory)) return false;
        
        const recipe = this.recipes[recipeName];
        
        // Remove ingredients
        for (const [ingredient, count] of Object.entries(recipe.ingredients)) {
            inventory.removeItem(ingredient, count);
        }
        
        // Add result
        inventory.addItem(recipe.result.type, recipe.result.count);
        return true;
    }
}

// Block System
class BlockSystem {
    constructor() {
        this.blockTypes = this.initializeBlockTypes();
    }

    initializeBlockTypes() {
        return {
            grass: {
                name: 'Grass Block',
                hardness: 1.0,
                drops: 'dirt',
                transparent: false
            },
            dirt: {
                name: 'Dirt',
                hardness: 0.5,
                drops: 'dirt',
                transparent: false
            },
            stone: {
                name: 'Stone',
                hardness: 3.0,
                drops: 'cobblestone',
                transparent: false
            },
            wood: {
                name: 'Wood',
                hardness: 2.0,
                drops: 'wood',
                transparent: false
            },
            leaves: {
                name: 'Leaves',
                hardness: 0.2,
                drops: null,
                transparent: true
            },
            coal: {
                name: 'Coal Ore',
                hardness: 3.0,
                drops: 'coal',
                transparent: false
            },
            iron: {
                name: 'Iron Ore',
                hardness: 3.0,
                drops: 'iron_ore',
                transparent: false
            },
            gold: {
                name: 'Gold Ore',
                hardness: 3.0,
                drops: 'gold_ore',
                transparent: false
            },
            diamond: {
                name: 'Diamond Ore',
                hardness: 3.0,
                drops: 'diamond',
                transparent: false
            }
        };
    }

    getBlockProperties(type) {
        return this.blockTypes[type] || this.blockTypes.stone;
    }
}

// Audio Manager
class AudioManager {
    constructor() {
        this.sounds = new Map();
        this.masterVolume = 0.7;
        this.initSounds();
    }

    initSounds() {
        // Initialize sound effects (placeholder - would load actual audio files)
        this.sounds.set('block_break', { volume: 0.5 });
        this.sounds.set('block_place', { volume: 0.5 });
        this.sounds.set('footstep', { volume: 0.3 });
        this.sounds.set('ambient', { volume: 0.2 });
    }

    playSound3D(soundName, position) {
        const sound = this.sounds.get(soundName);
        if (sound) {
            console.log(`Playing ${soundName} at position:`, position);
            // In a real implementation, this would play 3D positioned audio
        }
    }

    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.game = new BlockCraft();
});
