let scene, camera, renderer, clock;
let bus, busBoundingBox, busLights;
let roadSegments = [];
let roadsideObjects = [];
let zombies = [];
let projectiles = [];
let particles = [];
let score = 0;
let gameSpeed = 0.15;
let maxGameSpeed = 0.6;
let speedIncreaseFactor = 0.00018;
let isGameOver = false;
let gameRunning = false;
let targetBusLane = 0;
const laneWidth = 3.5;
const roadLength = 60;
const segmentLength = 5;
const numSegments = Math.ceil(roadLength / segmentLength);
const zombieSpawnInterval = 10; // Aggressive base interval
const MAX_ZOMBIES = 10; // Maximum zombies on screen
let lastZombieSpawnTime = 0;
const projectileSpeed = 0.8;
const fireRate = 250; // Cooldown between shots in ms
let lastFireTime = 0;
const textureScrollSpeedFactor = 2.5;

// --- Novas Variáveis de Munição ---
const maxAmmo = 10;
let ammoCount = maxAmmo;
let ammoBox = null; // Referência ao objeto THREE.Mesh da caixa de munição
let ammoBoxSpawnTimer = null; // ID do setTimeout para spawn da caixa
let isWaitingForAmmoBox = false; // Flag para indicar espera pelo spawn
const initialAmmoBoxSpawnDelay = 7000; // 7 segundos
const subsequentAmmoBoxSpawnDelay = 4000; // 4 segundos

const scoreElement = document.getElementById('score');
const ammoElement = document.getElementById('ammo-count'); // Referência ao elemento de munição
const messageBox = document.getElementById('message-box');
const messageText = document.getElementById('message-text');
const restartButton = document.getElementById('restart-button');
const gameContainer = document.getElementById('game-container');
// Canvas element reference is obtained in initThree

let audioContext;
let musicNode, engineNode, engineGain, engineFilter;
let musicPlaying = false;
const sounds = {};
let animationFrameId = null;
let musicSchedulerInterval = null; // Initialize globally

// --- Geometries & Materials (potentially reusable) ---
let sharedZombieTorsoGeo, sharedZombieHeadGeo, sharedZombieArmGeo, sharedZombieLegGeo;
let sharedZombieSkinMat, sharedZombieClothesMat;
let sharedParticleGeo, sharedParticleMatRed1, sharedParticleMatRed2, sharedParticleMatGreen;
let sharedAmmoBoxGeo, sharedAmmoBoxMat; // Geometria/Material para a caixa de munição

function createSharedAssets() {
     sharedZombieTorsoGeo = new THREE.BoxGeometry(0.8, 1.0, 0.5);
     sharedZombieHeadGeo = new THREE.SphereGeometry(0.4, 12, 10);
     sharedZombieArmGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
     sharedZombieLegGeo = new THREE.BoxGeometry(0.25, 0.9, 0.25);
     sharedZombieSkinMat = new THREE.MeshStandardMaterial({ color: 0x669966, roughness: 0.8 });
     sharedZombieClothesMat = new THREE.MeshStandardMaterial({ color: 0x443322, roughness: 0.9 });
     sharedParticleGeo = new THREE.SphereGeometry(0.15, 6, 4);
     sharedParticleMatRed1 = new THREE.MeshBasicMaterial({ color: 0xff0000 });
     sharedParticleMatRed2 = new THREE.MeshBasicMaterial({ color: 0x8B0000 });
     sharedParticleMatGreen = new THREE.MeshBasicMaterial({ color: 0x33cc33 });

     // Assets da Caixa de Munição
     sharedAmmoBoxGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
     sharedAmmoBoxMat = new THREE.MeshStandardMaterial({
         map: createAmmoTexture(), // Criaremos esta função
         roughness: 0.7,
         metalness: 0.1
     });

     console.log("Shared assets created.");
}

 function disposeSharedAssets() {
    sharedZombieTorsoGeo?.dispose(); sharedZombieHeadGeo?.dispose(); sharedZombieArmGeo?.dispose(); sharedZombieLegGeo?.dispose();
    sharedZombieSkinMat?.dispose(); sharedZombieClothesMat?.dispose();
    sharedParticleGeo?.dispose(); sharedParticleMatRed1?.dispose(); sharedParticleMatRed2?.dispose(); sharedParticleMatGreen?.dispose();
    sharedAmmoBoxGeo?.dispose(); sharedAmmoBoxMat?.map?.dispose(); sharedAmmoBoxMat?.dispose(); // Dispose assets da caixa

    sharedZombieTorsoGeo = sharedZombieHeadGeo = sharedZombieArmGeo = sharedZombieLegGeo = null;
    sharedZombieSkinMat = sharedZombieClothesMat = null;
    sharedParticleGeo = sharedParticleMatRed1 = sharedParticleMatRed2 = sharedParticleMatGreen = null;
    sharedAmmoBoxGeo = sharedAmmoBoxMat = null; // Limpa refs da caixa
    console.log("Shared assets disposed.");
 }

// --- Funções de Inicialização e Jogo ---
function mainInit() {
    const startButton = document.getElementById('start-button');
    const startScreen = document.getElementById('start-screen');
    if (!startButton || !startScreen) {
        console.error("Start button or screen not found!");
        return;
    }
    startButton.addEventListener('click', () => startGame(startScreen));
}

function startGame(startScreen) {
    console.log("Starting game...");
    startScreen.style.display = 'none';
    gameContainer.style.display = 'block';

    isGameOver = false;
    gameRunning = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (scene) disposeSceneContents(scene);
    if (renderer) { renderer.dispose(); renderer = null; }
    disposeSharedAssets();

    initAudio();
    requestFullscreen();
    initThree(); // Cria tudo, incluindo o estado inicial resetado via resetGameState

    if (scene && renderer && camera) { // Verifica se a inicialização foi bem sucedida
        gameRunning = true;
        isGameOver = false;
        if(!clock) clock = new THREE.Clock();
        lastZombieSpawnTime = clock.getElapsedTime();
        lastFireTime = 0; // Reseta o cooldown do tiro
        if (!animationFrameId) animate();
        console.log("Game started successfully.");
    } else {
        console.error("Game start failed due to initialization errors.");
        // Opcional: Mostrar mensagem de erro ao usuário
    }
}

 function requestFullscreen() {
    const element = document.documentElement;
    if (element.requestFullscreen) { element.requestFullscreen().catch(err => { console.warn(`Fullscreen error: ${err.message} (${err.name})`); }); }
    else if (element.mozRequestFullScreen) { element.mozRequestFullScreen(); }
    else if (element.webkitRequestFullscreen) { element.webkitRequestFullscreen(); }
    else if (element.msRequestFullscreen) { element.msRequestFullscreen(); }
 }

function initThree() {
     console.log("Initializing Three.js...");
    if (!clock) clock = new THREE.Clock();

    if (scene) {
        console.warn("initThree called with existing scene. Disposing first.");
        disposeSceneContents(scene);
    }
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05050a);
    scene.fog = new THREE.Fog(0x05050a, 15, 80);

    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.set(0, 6, 12);
    camera.lookAt(0, 2, 0);

    const canvas = document.getElementById('gameCanvas');
    if (!canvas) { console.error("Canvas element #gameCanvas not found!"); return; }
    if (renderer) {
         console.warn("initThree called with existing renderer. Disposing first.");
         renderer.dispose();
     }
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const ambientLight = new THREE.AmbientLight(0x404050);
    scene.add(ambientLight);
    const moonLight = new THREE.DirectionalLight(0x6070a0, 0.7);
    moonLight.position.set(-10, 15, -5); moonLight.castShadow = true; moonLight.shadow.mapSize.width = 2048; moonLight.shadow.mapSize.height = 2048; moonLight.shadow.camera.near = 0.5; moonLight.shadow.camera.far = 50; moonLight.shadow.camera.left = -30; moonLight.shadow.camera.right = 30; moonLight.shadow.camera.top = 30; moonLight.shadow.camera.bottom = -30;
    scene.add(moonLight);

    createSharedAssets(); // Cria assets compartilhados, incluindo os da caixa de munição
    createBusEnhanced();
    resetGameState(); // Reseta score, velocidade, posições, *e munição*
    createInitialRoad();
    createInitialRoadsideObjects();

    document.removeEventListener('keydown', handleKeyDown); document.addEventListener('keydown', handleKeyDown);
    restartButton.removeEventListener('click', restartGame); restartButton.addEventListener('click', restartGame);
    window.removeEventListener('resize', onWindowResize); window.addEventListener('resize', onWindowResize);

    hideMessage();
    updateAmmoUI(); // Atualiza a UI da munição na inicialização
    console.log("Three.js initialization complete.");
}

function resetGameState() {
     console.log("Resetting game state...");
     score = 0; gameSpeed = 0.15; targetBusLane = 0;
     if(clock) lastZombieSpawnTime = clock.getElapsedTime(); else lastZombieSpawnTime = 0;
     lastFireTime = 0;

     // Limpar arrays
     zombies = []; projectiles = []; particles = []; roadSegments = []; roadsideObjects = [];

     // Resetar Munição e Caixa
     ammoCount = maxAmmo;
     if (ammoBox && scene) {
         scene.remove(ammoBox);
         // Geometria/Material são shared, não precisam dispose aqui
     }
     ammoBox = null;
     if (ammoBoxSpawnTimer) {
         clearTimeout(ammoBoxSpawnTimer);
         ammoBoxSpawnTimer = null;
     }
     isWaitingForAmmoBox = false;

     // Resetar Posição do Ônibus
     if(bus) { bus.position.set(0, 0.5, 0); bus.rotation.set(0, 0, 0); }
     else { console.warn("ResetGameState: Bus not found."); }

     updateScore();
     updateAmmoUI(); // Garante que a UI de munição está correta
     console.log("Game state reset.");
}

// --- Funções de Criação de Objetos ---

function createBusEnhanced() {
     console.log("Creating bus...");
     bus = new THREE.Group(); bus.position.y = 0.5;
    const bodyColor = 0x8B0000; const metalColor = 0x555555; const windowColor = 0x111122; const tireColor = 0x1a1a1a;
    const chassisGeo = new THREE.BoxGeometry(2.2, 1.4, 5); const chassisMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6, metalness: 0.4 }); const chassis = new THREE.Mesh(chassisGeo, chassisMat); chassis.position.y = 0.7; chassis.castShadow = true; chassis.receiveShadow = true; bus.add(chassis);
    const cabinGeo = new THREE.BoxGeometry(2, 1, 1.8); const cabinMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5, metalness: 0.5 }); const cabin = new THREE.Mesh(cabinGeo, cabinMat); cabin.position.set(0, 1.4 + 0.5, -1.6); cabin.castShadow = true; bus.add(cabin);
    const grillGeo = new THREE.PlaneGeometry(1.8, 0.6); const grillMat = new THREE.MeshStandardMaterial({ color: metalColor, roughness: 0.2, metalness: 0.8 }); const grill = new THREE.Mesh(grillGeo, grillMat); grill.position.set(0, 0.6, -2.51); bus.add(grill);
    const windowMat = new THREE.MeshStandardMaterial({ color: windowColor, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.8 }); const frontWindowGeo = new THREE.PlaneGeometry(1.8, 0.7); const frontWindow = new THREE.Mesh(frontWindowGeo, windowMat); frontWindow.position.set(0, 1.4 + 0.5, -1.6 + 1.8/2 + 0.01); frontWindow.rotation.x = -Math.PI / 10; bus.add(frontWindow);
    const sideWindowGeo = new THREE.PlaneGeometry(3.5, 0.8); const leftWindow = new THREE.Mesh(sideWindowGeo, windowMat); leftWindow.position.set(-1.11, 1.2, 0); leftWindow.rotation.y = Math.PI / 2; bus.add(leftWindow); const rightWindow = leftWindow.clone(); rightWindow.position.x = 1.11; bus.add(rightWindow);
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 24); const wheelMat = new THREE.MeshStandardMaterial({ color: tireColor, roughness: 0.8, metalness: 0.1 }); const wheelPositions = [ { x: -1.1, z: 1.8 }, { x: 1.1, z: 1.8 }, { x: -1.1, z: -1.8 }, { x: 1.1, z: -1.8 } ]; wheelPositions.forEach(pos => { const wheel = new THREE.Mesh(wheelGeo, wheelMat); wheel.rotation.z = Math.PI / 2; wheel.position.set(pos.x, 0.5, pos.z); wheel.castShadow = true; bus.add(wheel); });
    busLights = { headlights: [], taillights: [] }; const lightIntensity = 5; const lightDistance = 20; const lightAngle = Math.PI / 6; const lightPenumbra = 0.2;
    const headlight1 = new THREE.SpotLight(0xffffdd, lightIntensity, lightDistance, lightAngle, lightPenumbra, 1); headlight1.position.set(-0.7, 0.8, -2.6); headlight1.target.position.set(-0.7, 0.5, -10); bus.add(headlight1); bus.add(headlight1.target); busLights.headlights.push(headlight1);
    const headlight2 = headlight1.clone(); headlight2.position.set(0.7, 0.8, -2.6); headlight2.target.position.set(0.7, 0.5, -10); bus.add(headlight2); bus.add(headlight2.target); busLights.headlights.push(headlight2);
    const headLightGeo = new THREE.SphereGeometry(0.15, 16, 8); const headLightMat = new THREE.MeshBasicMaterial({color: 0xffffaa}); const hl1Mesh = new THREE.Mesh(headLightGeo, headLightMat); hl1Mesh.position.copy(headlight1.position); bus.add(hl1Mesh); const hl2Mesh = new THREE.Mesh(headLightGeo, headLightMat); hl2Mesh.position.copy(headlight2.position); bus.add(hl2Mesh);
    const tailLightGeo = new THREE.BoxGeometry(0.3, 0.2, 0.1); const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); const tl1 = new THREE.Mesh(tailLightGeo, tailLightMat); tl1.position.set(-0.8, 1.0, 2.5); bus.add(tl1); const tl2 = tl1.clone(); tl2.position.x = 0.8; bus.add(tl2); busLights.taillights.push(tl1, tl2);
    if (scene) scene.add(bus); else console.error("Scene not available for adding bus");
     try { busBoundingBox = new THREE.Box3().setFromObject(bus); }
     catch(e) { console.error("Error creating bus bounding box", e); busBoundingBox = new THREE.Box3(new THREE.Vector3(-1.1,0,-2.5), new THREE.Vector3(1.1,2,2.5)); } // Fallback mais preciso
     console.log("Bus created.");
}

function createRoadSegment(centerZ) {
    const segmentWidth = laneWidth * 3 + 8;
    const roadGeometry = new THREE.PlaneGeometry(segmentWidth, segmentLength);
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x333338, map: createRoadTextureEnhanced(), normalMap: createRoadNormalMap(), roughness: 0.9, metalness: 0.1, side: THREE.DoubleSide });
    roadMaterial.map.needsUpdate = true;
    roadMaterial.normalMap.needsUpdate = true;

    const roadSegment = new THREE.Mesh(roadGeometry, roadMaterial);
    roadSegment.rotation.x = -Math.PI / 2;
    roadSegment.position.set(0, 0, centerZ);
    roadSegment.receiveShadow = true;
    if (scene) scene.add(roadSegment); else console.error("Scene not available for road segment");
    return roadSegment;
}
function createRoadTextureEnhanced() {
    const canvas = document.createElement('canvas'); const size = 128; canvas.width = size; canvas.height = size; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#3a3a40'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 8000; i++) { const x = Math.random() * size; const y = Math.random() * size; const c = Math.floor(Math.random() * 30 + 40); const alpha = Math.random() * 0.5 + 0.3; ctx.fillStyle = `rgba(${c},${c},${c}, ${alpha})`; ctx.fillRect(x, y, 1, 1); }
    ctx.strokeStyle = '#222'; ctx.lineWidth = 0.5; for(let i=0; i<5; i++){ ctx.beginPath(); ctx.moveTo(Math.random()*size, Math.random()*size); ctx.lineTo(Math.random()*size, Math.random()*size); ctx.stroke(); } ctx.fillStyle = '#cccccc';
    const lineX1 = size / 2 - laneWidth * (size / (laneWidth * 3)) / 2; const lineX2 = size / 2 + laneWidth * (size / (laneWidth * 3)) / 2; const dashLength = size * 0.2; const gapLength = size * 0.15; const lineWidth = size * 0.015; for (let y = 0; y < size; y += dashLength + gapLength) { ctx.fillRect(lineX1 - lineWidth / 2, y, lineWidth, dashLength); ctx.fillRect(lineX2 - lineWidth / 2, y, lineWidth, dashLength); }
    const texture = new THREE.CanvasTexture(canvas); texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.repeat.set( (laneWidth * 3 + 8) / (laneWidth * 2) , 1);
    texture.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 1; texture.needsUpdate = true; return texture;
}
 function createRoadNormalMap() {
    const canvas = document.createElement('canvas'); const size = 128; canvas.width = size; canvas.height = size; const ctx = canvas.getContext('2d'); ctx.fillStyle = 'rgb(128, 128, 255)'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 500; i++) { const x = Math.random() * size; const y = Math.random() * size; const r = Math.floor(Math.random() * 50 + 100); const g = Math.floor(Math.random() * 50 + 100); ctx.fillStyle = `rgb(${r},${g},230)`; ctx.fillRect(x, y, 1, 1); }
    const normalTexture = new THREE.CanvasTexture(canvas); normalTexture.wrapS = THREE.RepeatWrapping; normalTexture.wrapT = THREE.RepeatWrapping; const tempRoadTexture = createRoadTextureEnhanced();
    if (tempRoadTexture && tempRoadTexture.repeat) { normalTexture.repeat.copy(tempRoadTexture.repeat); } else { normalTexture.repeat.set(1,1); }
    normalTexture.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 1; normalTexture.needsUpdate = true; return normalTexture;
}

function createInitialRoad() {
     console.log("Creating initial road...");
    roadSegments.forEach(seg => { if (scene) scene.remove(seg); disposeMaterial(seg.material); seg.geometry?.dispose(); }); roadSegments = [];
    let lastCreatedSegmentZ = 0;
    for (let i = 0; i < numSegments + 10; i++) {
        const centerZ = -i * segmentLength;
        const segment = createRoadSegment(centerZ);
        roadSegments.push(segment);
        lastCreatedSegmentZ = centerZ;
    }
     console.log(`Initial road created.`);
}

 function createRoadsideObject(zPos) {
     const side = Math.random() < 0.5 ? -1 : 1; const lateralOffset = laneWidth * 1.5 + Math.random() * 5 + 3;
    let object = new THREE.Group(); const type = Math.random();
     if (type < 0.4) { const poleGeo = new THREE.CylinderGeometry(0.1, 0.15, 6 + Math.random() * 2, 8); const poleMat = new THREE.MeshStandardMaterial({color: 0x555555, roughness: 0.8, metalness: 0.5}); const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.y = poleGeo.parameters.height / 2; pole.rotation.z = (Math.random() - 0.5) * 0.3 * side; pole.castShadow = true; object.add(pole); }
     else { const trunkHeight = Math.random() * 3 + 4; const trunkRadius = Math.random() * 0.2 + 0.15; const foliageBaseRadius = Math.random() * 1.0 + 0.8; const foliageHeight = Math.random() * 3 + 2.5; const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.8, trunkRadius, trunkHeight, 8); const trunkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x5C3D2E).lerp(new THREE.Color(0x4A2E1F), Math.random()), roughness: 0.9 }); const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.y = trunkHeight / 2; trunk.castShadow = true; object.add(trunk); const foliageGroup = new THREE.Group(); foliageGroup.position.y = trunkHeight * 0.9; object.add(foliageGroup); const foliageCount = 5 + Math.floor(Math.random() * 6); for (let i = 0; i < foliageCount; i++) { const sphereRadius = foliageBaseRadius * (0.4 + Math.random() * 0.5); const foliageSphereGeo = new THREE.IcosahedronGeometry(sphereRadius, 0); const foliageSphereMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x2E8B57).lerp(new THREE.Color(0x3CB371), Math.random()), roughness: 0.9 }); const foliageSphere = new THREE.Mesh(foliageSphereGeo, foliageSphereMat); const yOffset = Math.random() * foliageHeight * 0.8; const radialDist = Math.random() * foliageBaseRadius * 0.7; const angle = Math.random() * Math.PI * 2; const xOffset = Math.cos(angle) * radialDist; const zOffset = Math.sin(angle) * radialDist; foliageSphere.position.set(xOffset, yOffset, zOffset); foliageSphere.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI); foliageSphere.castShadow = true; foliageGroup.add(foliageSphere); } }
    object.position.set(side * lateralOffset, 0, zPos); roadsideObjects.push(object);
     if (scene) { scene.add(object); } else { console.error("Scene not ready for roadside object"); }
}
 function createInitialRoadsideObjects() {
     console.log("Creating initial roadside objects...");
     roadsideObjects.forEach(obj => { if (scene) scene.remove(obj); obj.traverse(child => { if(child.isMesh) { child.geometry?.dispose(); disposeMaterial(child.material); } }); }); roadsideObjects = [];
     const distanceBetweenObjects = 8; const minDistance = 4;
     for (let z = 0; z > -roadLength - 50; z -= Math.random() * distanceBetweenObjects + minDistance) { createRoadsideObject(z); }
     console.log("Initial roadside objects created.");
 }

function createZombieEnhanced(lane) {
    if (!sharedZombieTorsoGeo) { console.warn("Shared assets not ready, creating zombie might fail."); createSharedAssets(); }
    const zombieGroup = new THREE.Group(); zombieGroup.userData.moveSpeed = (Math.random() * 0.01 + 0.005) * (1 + gameSpeed * 2); zombieGroup.userData.animationOffset = Math.random() * Math.PI * 2;
    const currentSkinMat = sharedZombieSkinMat.clone(); currentSkinMat.color.lerp(new THREE.Color(0x88aa88), Math.random()*0.5); const currentClothesMat = sharedZombieClothesMat.clone(); currentClothesMat.color.lerp(new THREE.Color(0x221105), Math.random()*0.5);
    const torso = new THREE.Mesh(sharedZombieTorsoGeo, currentClothesMat); torso.position.y = 0.9; torso.castShadow = true; zombieGroup.add(torso);
    const head = new THREE.Mesh(sharedZombieHeadGeo, currentSkinMat); head.position.y = 1.4 + 0.35; head.castShadow = true; zombieGroup.add(head);
    const leftArm = new THREE.Mesh(sharedZombieArmGeo, currentSkinMat); leftArm.position.set(-0.5, 1.0, 0); leftArm.castShadow = true; zombieGroup.add(leftArm); zombieGroup.userData.leftArm = leftArm;
    const rightArm = new THREE.Mesh(sharedZombieArmGeo, currentSkinMat); rightArm.position.set(0.5, 1.0, 0); rightArm.castShadow = true; zombieGroup.add(rightArm); zombieGroup.userData.rightArm = rightArm;
    const leftLeg = new THREE.Mesh(sharedZombieLegGeo, currentClothesMat); leftLeg.position.set(-0.2, 0.45, 0); leftLeg.castShadow = true; zombieGroup.add(leftLeg); zombieGroup.userData.leftLeg = leftLeg;
    const rightLeg = new THREE.Mesh(sharedZombieLegGeo, currentClothesMat); rightLeg.position.set(0.2, 0.45, 0); rightLeg.castShadow = true; zombieGroup.add(rightLeg); zombieGroup.userData.rightLeg = rightLeg;
    const zPos = -roadLength - Math.random() * 40 - 30; const xPos = lane * laneWidth; zombieGroup.position.set(xPos, 0, zPos); zombieGroup.rotation.y = Math.random() * 0.4 - 0.2;
    zombieGroup.userData.boundingBox = new THREE.Box3(); zombieGroup.userData.needsBoxUpdate = true;
    zombies.push(zombieGroup); if (scene) scene.add(zombieGroup); else console.error("Scene not ready for zombie");
}

function createProjectileEnhanced() {
    // --- Verificação de Munição ---
    if (ammoCount <= 0) {
        // Opcional: Tocar um som de clique seco ("dry fire")
        // playSound('dryFire');
        console.log("Out of ammo!");
        return; // Não cria o projétil
    }
    // --- Fim da Verificação ---

    if (!bus) return;
    const currentTime = clock.getElapsedTime() * 1000; // Tempo atual em milissegundos
    if (currentTime - lastFireTime < fireRate) {
        return; // Respeita o cooldown
    }

    ammoCount--; // Decrementa munição
    lastFireTime = currentTime; // Atualiza o tempo do último disparo
    updateAmmoUI(); // Atualiza a UI

    const projGroup = new THREE.Group(); const projectileLength = 1.5; const projectileRadius = 0.08; const projectileGeometry = new THREE.CylinderGeometry(projectileRadius, projectileRadius, projectileLength, 8); const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000}); const projectileMesh = new THREE.Mesh(projectileGeometry, projectileMaterial); projectileMesh.rotation.x = Math.PI / 2; projGroup.add(projectileMesh); const projLight = new THREE.PointLight(0xff4444, 1.5, 5); projGroup.add(projLight);
    const firePosZ = bus.position.z - 2.8; projGroup.position.copy(bus.position); projGroup.position.y = 1.2; projGroup.position.z = firePosZ;
    try { projGroup.userData.boundingBox = new THREE.Box3().setFromObject(projectileMesh); } catch(e) { console.error("Error setting projectile bounding box", e); projGroup.userData.boundingBox = new THREE.Box3(new THREE.Vector3(-0.1,-0.1,-0.75), new THREE.Vector3(0.1,0.1,0.75)); }
    projGroup.userData.isProjectile = true; projectiles.push(projGroup); if(scene) scene.add(projGroup); else console.error("Scene not ready for projectile"); playSound('shoot');

    // --- Iniciar Timer para Caixa de Munição se Acabou ---
    if (ammoCount <= 0 && !isWaitingForAmmoBox && !ammoBox) {
        console.log("Ammo depleted! Scheduling ammo box spawn...");
        scheduleAmmoBoxSpawn(initialAmmoBoxSpawnDelay); // Agenda para 7 segundos
    }
    // --- Fim do Timer ---
}

// --- Novas Funções de Munição ---

function createAmmoTexture() {
    const canvas = document.createElement('canvas');
    const size = 64;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base color (wooden crate like)
    ctx.fillStyle = '#a0522d'; // Sienna
    ctx.fillRect(0, 0, size, size);

    // Border
    ctx.strokeStyle = '#5c3d2e'; // Darker brown
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, size, size);

    // Simple "AMMO" text or symbol
    ctx.fillStyle = '#eeeeee';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Simple bullet symbol (can be improved)
    ctx.fillText('💥', size / 2, size / 2 + 2);
    // ctx.fillText('AMMO', size / 2, size / 2);


    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function scheduleAmmoBoxSpawn(delay) {
    if (ammoBoxSpawnTimer) {
        clearTimeout(ammoBoxSpawnTimer); // Limpa timer anterior se houver
    }
    isWaitingForAmmoBox = true;
    ammoBoxSpawnTimer = setTimeout(() => {
        spawnAmmoBox();
        ammoBoxSpawnTimer = null; // Limpa o ID após a execução
    }, delay);
    console.log(`Ammo box spawn scheduled in ${delay / 1000} seconds.`);
}

function spawnAmmoBox() {
    if (!scene || !sharedAmmoBoxGeo || !sharedAmmoBoxMat || ammoBox) {
        console.warn("Cannot spawn ammo box. Scene/Assets missing or box already exists.");
        isWaitingForAmmoBox = false; // Reset flag if spawn failed
        return;
    }

    console.log("Spawning ammo box!");
    const boxMesh = new THREE.Mesh(sharedAmmoBoxGeo, sharedAmmoBoxMat);
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;

    // Posição: Lane aleatória, um pouco à frente do início da "zona de spawn" dos zumbis
    const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    const xPos = lane * laneWidth;
    const zPos = -roadLength - 15 - Math.random() * 10; // Garante que spawne bem à frente
    const yPos = 0.5; // Um pouco acima do chão

    boxMesh.position.set(xPos, yPos, zPos);

    // Adiciona um pequeno movimento de rotação/flutuação
    boxMesh.userData.initialY = yPos;
    boxMesh.userData.rotationSpeed = (Math.random() - 0.5) * 0.02;
    boxMesh.userData.bobbleSpeed = Math.random() * 2 + 1;

    // Bounding Box para colisão
    boxMesh.userData.boundingBox = new THREE.Box3();
    boxMesh.userData.boundingBox.setFromObject(boxMesh); // Calcula BBox inicial

    ammoBox = boxMesh; // Armazena a referência
    isWaitingForAmmoBox = false; // Não está mais esperando, a caixa spawnou
    scene.add(ammoBox);
}

function updateAmmoBox(deltaTime) {
    if (!ammoBox || !scene || !camera || !clock) return;

    // Movimento em Z (em direção ao jogador)
    ammoBox.position.z += gameSpeed; // Move com a velocidade do jogo

    // Movimento de flutuação/rotação cosmético
    ammoBox.rotation.y += ammoBox.userData.rotationSpeed;
    ammoBox.position.y = ammoBox.userData.initialY + Math.sin(clock.getElapsedTime() * ammoBox.userData.bobbleSpeed) * 0.1;


    // Atualizar Bounding Box
    try {
        if (ammoBox && ammoBox.userData && ammoBox.userData.boundingBox) {
            ammoBox.userData.boundingBox.setFromObject(ammoBox);
        } else if(ammoBox) {
            console.warn("Ammo box or its bounding box data is missing during update.");
             ammoBox.userData.boundingBox = new THREE.Box3().setFromObject(ammoBox); // Tenta recriar
        }
    } catch (e) {
        console.error("Error updating ammo box bounding box:", e);
        // Tenta criar um fallback se não existir
        if(ammoBox && !ammoBox.userData.boundingBox) {
             ammoBox.userData.boundingBox = new THREE.Box3().setFromCenterAndSize(ammoBox.position, new THREE.Vector3(1,1,1));
        }
    }

    // Verificar se a caixa foi perdida (passou pela câmera/jogador)
    const missThreshold = camera.position.z + 5; // Ponto Z onde a caixa é considerada perdida
    if (ammoBox.position.z > missThreshold) {
        console.log("Ammo box missed!");
        scene.remove(ammoBox);
        // Não precisa dispose de geo/mat (são shared)
        ammoBox = null;
        // Agenda a próxima caixa com delay menor
        scheduleAmmoBoxSpawn(subsequentAmmoBoxSpawnDelay);
    }
}

// --- Funções de Áudio ---
 function initAudio() {
     console.log("Initializing Audio...");
    if (audioContext && audioContext.state === 'closed') { audioContext = null; }
    if (!audioContext) {
        try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); console.log("AudioContext CREATED."); }
        catch (e) { console.error("Web Audio API not supported or failed to init!", e); audioContext = null; return; }
    }
    if (audioContext.state === 'suspended') { audioContext.resume(); console.log("AudioContext Resumed.");}

    if (!sounds.noise) {
         try {
            const bufferSize = audioContext.sampleRate * 0.5; const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate); const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) { output[i] = Math.random() * 2 - 1; } sounds.noise = noiseBuffer;
            console.log("Noise buffer created.");
         } catch (e) {
             console.error("Error creating noise buffer:", e);
             audioContext = null; return;
         }
    }
    createEngineSound(); createBackgroundMusic();
     console.log("Audio initialization complete.");
}
function createEngineSound() {
    if (!audioContext) return; if (engineNode) { try { engineNode.stop(); } catch(e) {} engineNode.disconnect(); engineFilter?.disconnect(); engineGain?.disconnect(); }
    engineNode = audioContext.createOscillator(); engineGain = audioContext.createGain(); engineFilter = audioContext.createBiquadFilter();
    engineNode.type = 'sawtooth'; engineNode.frequency.setValueAtTime(40, audioContext.currentTime); engineFilter.type = 'lowpass'; engineFilter.frequency.setValueAtTime(200, audioContext.currentTime); engineFilter.Q.setValueAtTime(5, audioContext.currentTime);
    engineGain.gain.setValueAtTime(0.0, audioContext.currentTime); engineGain.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.5);
    engineNode.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(audioContext.destination); try { engineNode.start(); } catch(e) { console.warn("Could not start engine node, context might be closed."); }
}
function updateEngineSound() {
    if (!audioContext || !engineNode || !engineGain || !engineFilter || audioContext.state !== 'running') return;
    if (!gameRunning || isGameOver) { if (engineGain.gain.value > 0.001) { try { engineGain.gain.cancelScheduledValues(audioContext.currentTime); engineGain.gain.setValueAtTime(engineGain.gain.value, audioContext.currentTime); engineGain.gain.linearRampToValueAtTime(0.0, audioContext.currentTime + 0.1); } catch(e) { engineGain.gain.value = 0;} } return; };
    const baseFreq = 40; const speedFreqFactor = 100; const targetFreq = baseFreq + gameSpeed * speedFreqFactor; try { engineNode.frequency.setTargetAtTime(targetFreq, audioContext.currentTime, 0.1); } catch(e) { engineNode.frequency.value = targetFreq; }
    const baseGain = 0.08; const speedGainFactor = 0.1; const targetGain = Math.min(baseGain + gameSpeed * speedGainFactor, 0.15); try { engineGain.gain.setTargetAtTime(targetGain, audioContext.currentTime, 0.1); } catch(e) { engineGain.gain.value = targetGain; }
    const filterMod = Math.random() * 50 - 25; const targetFilterFreq = 200 + filterMod + gameSpeed * 150; try { engineFilter.frequency.setTargetAtTime(targetFilterFreq, audioContext.currentTime, 0.05); } catch(e) { engineFilter.frequency.value = targetFilterFreq; }
}
function playSound(type, position = null) {
     if (!audioContext || audioContext.state !== 'running' || !gameRunning || !sounds.noise) return; let sourceNode; let gainNode = audioContext.createGain(); gainNode.connect(audioContext.destination); const now = audioContext.currentTime;
     try {
         switch (type) {
            case 'shoot': sourceNode = audioContext.createBufferSource(); sourceNode.buffer = sounds.noise; const filterNode = audioContext.createBiquadFilter(); filterNode.type = 'bandpass'; filterNode.frequency.value = 1500 + Math.random() * 500; filterNode.Q.value = 5; sourceNode.connect(filterNode); filterNode.connect(gainNode); gainNode.gain.setValueAtTime(0.4, now); gainNode.gain.linearRampToValueAtTime(0, now + 0.1); sourceNode.start(now); sourceNode.stop(now + 0.1); sourceNode.onended = () => { try { sourceNode?.disconnect(); filterNode?.disconnect(); gainNode?.disconnect(); } catch(e){} }; break;
            case 'hit': sourceNode = audioContext.createBufferSource(); sourceNode.buffer = sounds.noise; const hitFilter = audioContext.createBiquadFilter(); hitFilter.type = 'lowpass'; hitFilter.frequency.value = 400 + Math.random() * 100; hitFilter.Q.value = 2; const thumpOsc = audioContext.createOscillator(); thumpOsc.type = 'sine'; const thumpGain = audioContext.createGain(); thumpOsc.frequency.setValueAtTime(80, now); thumpOsc.frequency.linearRampToValueAtTime(40, now + 0.15); thumpGain.gain.setValueAtTime(0.5, now); thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15); sourceNode.connect(hitFilter); hitFilter.connect(gainNode); thumpOsc.connect(thumpGain); thumpGain.connect(gainNode); gainNode.gain.setValueAtTime(0.6, now); gainNode.gain.linearRampToValueAtTime(0, now + 0.2); sourceNode.start(now); sourceNode.stop(now + 0.2); thumpOsc.start(now); thumpOsc.stop(now + 0.15); sourceNode.onended = () => { try { sourceNode?.disconnect(); hitFilter?.disconnect(); thumpOsc?.disconnect(); thumpGain?.disconnect(); gainNode?.disconnect(); } catch(e){} }; break;
            case 'gameOver': const duration = 1.5; const osc = audioContext.createOscillator(); const oscGain = audioContext.createGain(); osc.type = 'square'; osc.frequency.setValueAtTime(200, now); osc.frequency.exponentialRampToValueAtTime(50, now + duration); oscGain.gain.setValueAtTime(0.3, now); oscGain.gain.linearRampToValueAtTime(0, now + duration); osc.connect(oscGain); oscGain.connect(audioContext.destination); osc.start(now); osc.stop(now + duration); osc.onended = () => { try { osc?.disconnect(); oscGain?.disconnect(); } catch(e){} }; break;
            // --- Novo Som: Ammo Pickup ---
            case 'ammoPickup':
                const pickupOsc = audioContext.createOscillator();
                const pickupGain = audioContext.createGain();
                pickupOsc.type = 'triangle';
                pickupOsc.frequency.setValueAtTime(440, now); // A4
                pickupOsc.frequency.linearRampToValueAtTime(880, now + 0.15); // A5
                pickupGain.gain.setValueAtTime(0.0, now);
                pickupGain.gain.linearRampToValueAtTime(0.3, now + 0.05); // Quick attack
                pickupGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25); // Decay
                pickupOsc.connect(pickupGain);
                pickupGain.connect(audioContext.destination);
                pickupOsc.start(now);
                pickupOsc.stop(now + 0.25);
                pickupOsc.onended = () => { try { pickupOsc?.disconnect(); pickupGain?.disconnect(); } catch(e){} };
                break;
            // --- Fim do Novo Som ---
        }
     } catch (e) { console.error("Error playing sound:", type, e); try {gainNode?.disconnect();} catch(e){} }
}
function createBackgroundMusic() {
    if (!audioContext || audioContext.state !== 'running') return;
    stopMusic();
    const bassLine = [ [noteToFreq('C2'), 1], [null, 0.5], [noteToFreq('G2'), 0.5], [noteToFreq('Eb2'), 1], [noteToFreq('C2'), 1], [null, 0.5], [noteToFreq('Ab2'), 0.5], [noteToFreq('G2'), 1] ]; const arpLine = [ [noteToFreq('C4'), 0.25], [noteToFreq('Eb4'), 0.25], [noteToFreq('G4'), 0.25],[noteToFreq('Eb4'), 0.25], [noteToFreq('C4'), 0.25], [noteToFreq('G3'), 0.25], [noteToFreq('Bb3'), 0.25],[noteToFreq('G3'), 0.25] ];
    const bpm = 110; const secondsPerBeat = 60.0 / bpm; let currentBeat = 0; let nextNoteTime = audioContext.currentTime; const lookahead = 0.1; const scheduleAheadTime = 0.2;
    function scheduleNotes() { if(!audioContext || audioContext.state !== 'running') { stopMusic(); return; } try { while (nextNoteTime < audioContext.currentTime + scheduleAheadTime) { const bassNoteIndex = Math.floor(currentBeat) % bassLine.length; const [bassFreq, bassDurationBeats] = bassLine[bassNoteIndex]; if (bassFreq !== null && currentBeat % 1 < 0.1 && gameRunning && !isGameOver) { playMusicNote(bassFreq, nextNoteTime, bassDurationBeats * secondsPerBeat * 0.9, 'sine', 0.3, 100); } const arpNoteIndex = Math.floor(currentBeat * 4) % arpLine.length; const [arpFreq, arpDurationBeats] = arpLine[arpNoteIndex]; const noteStartTime = nextNoteTime + (currentBeat % 1) * secondsPerBeat; if (arpFreq !== null && gameRunning && !isGameOver) { playMusicNote(arpFreq, noteStartTime, arpDurationBeats * secondsPerBeat * 0.8, 'triangle', 0.15, 1200); } const smallestBeatFraction = 0.25; nextNoteTime += smallestBeatFraction * secondsPerBeat; currentBeat += smallestBeatFraction; } } catch (e) { console.error("Error scheduling music notes:", e); stopMusic(); } }
    function playMusicNote(freq, startTime, duration, type = 'sine', gainVal = 0.2, filterFreq = 20000) { if (!audioContext || audioContext.state !== 'running' || !gameRunning || isGameOver) return; try { const osc = audioContext.createOscillator(); const gain = audioContext.createGain(); const filter = audioContext.createBiquadFilter(); osc.type = type; osc.frequency.setValueAtTime(freq, startTime); filter.type = 'lowpass'; filter.frequency.setValueAtTime(filterFreq, startTime); const attackTime = 0.01; const decayTime = duration * 0.3; const sustainLevel = 0.0; const releaseTime = duration * 0.6; gain.gain.setValueAtTime(0, startTime); gain.gain.linearRampToValueAtTime(gainVal, startTime + attackTime); gain.gain.linearRampToValueAtTime(sustainLevel * gainVal, startTime + attackTime + decayTime); gain.gain.setValueAtTime(sustainLevel * gainVal, startTime + duration - releaseTime); gain.gain.linearRampToValueAtTime(0, startTime + duration); osc.connect(filter); filter.connect(gain); gain.connect(audioContext.destination); osc.start(startTime); osc.stop(startTime + duration); osc.onended = () => { try { osc?.disconnect(); filter?.disconnect(); gain?.disconnect(); } catch(e){} }; } catch (e) { console.error("Error playing music note:", e); } }
    if (musicSchedulerInterval) clearInterval(musicSchedulerInterval);
    musicSchedulerInterval = setInterval(scheduleNotes, lookahead * 1000 / 2); musicPlaying = true; console.log("Música iniciada/reiniciada.");
}
function stopMusic() {
    if (musicSchedulerInterval) {
        clearInterval(musicSchedulerInterval);
        musicSchedulerInterval = null;
        musicPlaying = false;
        console.log("Música parada.");
    }
}
function noteToFreq(note) { if (!note) return null; const A4 = 440; const notes = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']; const octave = parseInt(note.slice(-1)); const key = note.slice(0, -1).toUpperCase(); const keyIndex = notes.indexOf(key); if (keyIndex < 0) return null; const semitones = keyIndex - notes.indexOf('A') + (octave - 4) * 12; return A4 * Math.pow(2, semitones / 12); }

// --- Funções de Atualização (Update) ---

function updateRoad(deltaTime) {
    if (!roadSegments || !camera || roadSegments.length === 0 || deltaTime <= 0) return;
    const distanceMoved = gameSpeed; // Simplificado: velocidade já considera o frame

    roadSegments.forEach(segment => {
        segment.position.z += distanceMoved;
        if (segment.material.map) { segment.material.map.offset.y -= gameSpeed * deltaTime * textureScrollSpeedFactor; }
        if (segment.material.normalMap) { segment.material.normalMap.offset.y -= gameSpeed * deltaTime * textureScrollSpeedFactor; }
    });

    const firstSegment = roadSegments[0];
    const firstSegmentFrontEdgeZ = firstSegment.position.z - segmentLength / 2;
    const recycleThreshold = camera.position.z + 10; // Aumentado um pouco para evitar pop-in

    if (firstSegmentFrontEdgeZ > recycleThreshold) {
         const lastSegment = roadSegments[roadSegments.length - 1];
        const lastSegmentCenterZ = lastSegment.position.z;
        const newSegmentCenterZ = lastSegmentCenterZ - segmentLength;

        if (scene) scene.remove(firstSegment);
        disposeMaterial(firstSegment.material);
        firstSegment.geometry?.dispose();
        roadSegments.shift();

        const newSegment = createRoadSegment(newSegmentCenterZ);
        roadSegments.push(newSegment);
    } else if (roadSegments.length < numSegments + 5) { // Garante que sempre haja segmentos suficientes
         const lastSegment = roadSegments[roadSegments.length - 1];
         const newSegmentCenterZ = lastSegment.position.z - segmentLength;
         const newSegment = createRoadSegment(newSegmentCenterZ);
         roadSegments.push(newSegment);
         console.log("Added extra road segment due to length check.");
    }
}
function updateRoadsideObjects() {
     if (!roadsideObjects || !camera || !scene) return;
     for (let i = roadsideObjects.length - 1; i >= 0; i--) {
         const obj = roadsideObjects[i]; if (!obj) { roadsideObjects.splice(i,1); continue; }
         obj.position.z += gameSpeed; // Move towards player
         if (obj.position.z > camera.position.z + 20) {
             scene.remove(obj);
             obj.traverse(child => { if (child.isMesh) { child.geometry?.dispose(); disposeMaterial(child.material); } });
             roadsideObjects.splice(i, 1);
         }
     }
     const lastObjectZ = roadsideObjects.length > 0 ? roadsideObjects[roadsideObjects.length - 1].position.z : 0;
     const spawnThreshold = -roadLength - 40; const distanceBetweenObjects = 8; const minDistance = 4;
     if (roadsideObjects.length < 30 || lastObjectZ > spawnThreshold + distanceBetweenObjects) { createRoadsideObject(lastObjectZ - (Math.random() * distanceBetweenObjects + minDistance)); }
 }
function updateZombies(deltaTime) {
    if (!clock || !zombies || !camera) return; const currentTime = clock.getElapsedTime();
    const dynamicSpawnInterval = Math.max(0.5, zombieSpawnInterval / (1 + gameSpeed * 20)); // Mais agressivo, mas com mínimo
    if (currentTime - lastZombieSpawnTime > dynamicSpawnInterval && zombies.length < MAX_ZOMBIES) {
        const lane = Math.floor(Math.random() * 3) - 1; createZombieEnhanced(lane); lastZombieSpawnTime = currentTime;
    }
    for (let i = zombies.length - 1; i >= 0; i--) {
        const zombie = zombies[i]; if (!zombie || !zombie.userData) { zombies.splice(i,1); continue; }
        zombie.position.z += gameSpeed + zombie.userData.moveSpeed;

        try { // Update BBox
            if (zombie && zombie.children.length > 0) {
                 if (!zombie.userData.boundingBox) { zombie.userData.boundingBox = new THREE.Box3(); }
                 zombie.userData.boundingBox.setFromObject(zombie, true);
            }
        } catch (e) {
            console.error("Error updating zombie bounding box:", e, zombie);
            if (zombie && !zombie.userData.boundingBox) zombie.userData.boundingBox = new THREE.Box3();
        }

        if (zombie.userData.leftArm) { const animSpeed = 5; const animAmount = 0.8; const time = currentTime * animSpeed + zombie.userData.animationOffset; zombie.userData.leftArm.rotation.x = Math.sin(time) * animAmount; zombie.userData.rightArm.rotation.x = -Math.sin(time) * animAmount; zombie.userData.leftLeg.rotation.x = -Math.sin(time) * animAmount * 0.5; zombie.userData.rightLeg.rotation.x = Math.sin(time) * animAmount * 0.5; zombie.rotation.y += Math.sin(time * 0.5) * 0.001; }
        if (zombie.position.z > camera.position.z + 10) { if(scene) scene.remove(zombie); zombie.traverse(child => { if (child.isMesh) { disposeMaterial(child.material); } }); zombies.splice(i, 1); }
    }
}
function updateProjectiles() {
     if (!projectiles) return;
     for (let i = projectiles.length - 1; i >= 0; i--) {
         const projectile = projectiles[i];
         if (!projectile || !projectile.userData) { projectiles.splice(i,1); continue; }
         projectile.position.z -= projectileSpeed;

         try { // Update BBox
            const mesh = projectile.children[0];
            if (mesh && mesh.geometry) {
                if (!projectile.userData.boundingBox) { projectile.userData.boundingBox = new THREE.Box3(); }
                projectile.userData.boundingBox.setFromObject(mesh, true);
            }
        } catch (e) {
            console.error("Error updating projectile bounding box:", e, projectile);
            if (projectile && !projectile.userData.boundingBox) projectile.userData.boundingBox = new THREE.Box3();
        }

         if (projectile.position.z < -roadLength - 30) { if(scene) scene.remove(projectile); projectile.traverse(child => { if(child.isLight) return; if (child.isMesh) { child.geometry?.dispose(); disposeMaterial(child.material); } }); projectiles.splice(i, 1); }
     }
}
function updateBusPosition() {
     if(!bus || !clock || !busBoundingBox) return; const targetX = targetBusLane * laneWidth; const lerpFactor = 0.1; bus.position.x += (targetX - bus.position.x) * lerpFactor; const tiltAngle = (targetX - bus.position.x) * -0.1; bus.rotation.z = tiltAngle; const swayFactor = 0.03; bus.position.y = 0.5 + Math.sin(clock.getElapsedTime() * 5) * swayFactor;
     try { busBoundingBox.setFromObject(bus); } // Atualiza o BBox do ônibus
     catch (e) { console.error("Error updating bus bounding box", e); }
 }
function checkCollisions() {
    if (isGameOver || !busBoundingBox || !zombies || !projectiles || !scene) return;

    // Projectile vs Zombie Collisions
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        if (!projectile || !projectile.userData || !projectile.userData.boundingBox || projectile.userData.boundingBox.isEmpty()) continue;

        for (let j = zombies.length - 1; j >= 0; j--) {
            const zombie = zombies[j];
            if (!zombie || !zombie.userData || !zombie.userData.boundingBox || zombie.userData.boundingBox.isEmpty()) continue;

            try {
                if (projectile.userData.boundingBox.intersectsBox(zombie.userData.boundingBox)) {
                    // console.log(`Collision: P[${i}] - Z[${j}]`);
                    createExplosionEnhanced(zombie.position.clone());
                    playSound('hit');

                    scene.remove(projectile);
                    projectile.traverse(child => { if(child.isMesh){ child.geometry?.dispose(); disposeMaterial(child.material); }});
                    projectiles.splice(i, 1);

                    scene.remove(zombie);
                    zombie.traverse(child => { if (child.isMesh) { disposeMaterial(child.material); } }); // Não dispose geo (shared)
                    zombies.splice(j, 1);

                    score += 10;
                    updateScore();
                    triggerCameraShake(0.1, 50);
                    i = -1; // Sai do loop P (projétil destruído)
                    break; // Sai do loop Z
                }
            } catch (e) {
                console.error("Collision check error (P-Z):", e, projectile, zombie);
            }
        }
    }

    // Bus vs Zombie Collisions
    if (!isGameOver) { // Só checa se o jogo não acabou no loop anterior
        for (let i = zombies.length - 1; i >= 0; i--) {
            const zombie = zombies[i];
            if (!zombie || !zombie.userData || !zombie.userData.boundingBox || zombie.userData.boundingBox.isEmpty()) continue;
            try {
                if (busBoundingBox && !busBoundingBox.isEmpty() && busBoundingBox.intersectsBox(zombie.userData.boundingBox)) {
                    console.log(`GAME OVER COLLISION: Bus and Z[${i}] !!!`);
                    gameOver();
                    return; // Sai da função de colisão imediatamente
                }
            } catch(e) {
                console.error("Collision check error (B-Z):", e, bus, zombie);
            }
        }
    }

    // --- Bus vs Ammo Box Collision ---
    if (ammoBox && ammoBox.userData && ammoBox.userData.boundingBox && busBoundingBox && !busBoundingBox.isEmpty() && !ammoBox.userData.boundingBox.isEmpty()) {
        try {
            if (busBoundingBox.intersectsBox(ammoBox.userData.boundingBox)) {
                console.log("Ammo box collected!");
                ammoCount = maxAmmo; // Recarrega
                updateAmmoUI(); // Atualiza UI
                playSound('ammoPickup'); // Toca som

                scene.remove(ammoBox);
                // Não precisa dispose de geo/mat (shared)
                ammoBox = null; // Limpa referência

                if (ammoBoxSpawnTimer) { // Cancela qualquer timer pendente
                    clearTimeout(ammoBoxSpawnTimer);
                    ammoBoxSpawnTimer = null;
                }
                isWaitingForAmmoBox = false; // Não está mais esperando

                triggerCameraShake(0.05, 30); // Pequeno shake visual
            }
        } catch(e) {
            console.error("Collision check error (B-Ammo):", e, bus, ammoBox);
        }
    }
    // --- Fim da Colisão da Caixa de Munição ---
}

function createExplosionEnhanced(position) {
     if (!scene || !clock || !sharedParticleGeo) return; const particleCount = 30 + Math.floor(Math.random() * 20); const materials = [sharedParticleMatRed1, sharedParticleMatRed2, sharedParticleMatGreen];
     const flashLight = new THREE.PointLight(0xffaaaa, 3, 15, 2); flashLight.position.copy(position); scene.add(flashLight); setTimeout(() => { if (scene) scene.remove(flashLight); }, 100);
     for (let i = 0; i < particleCount; i++) { const particleMat = materials[Math.floor(Math.random() * materials.length)]; const particle = new THREE.Mesh(sharedParticleGeo, particleMat); particle.position.copy(position); particle.position.add(new THREE.Vector3( (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5 )); const direction = new THREE.Vector3( Math.random() - 0.5, Math.random() * 0.6 + 0.2, Math.random() - 0.5 ).normalize(); const speed = Math.random() * 0.15 + 0.05; const gravity = -0.005; const life = Math.random() * 0.5 + 0.3; particle.userData = { direction, speed, gravity, life, birthTime: clock.getElapsedTime() }; particles.push(particle); scene.add(particle); }
}
function updateParticles(deltaTime) {
     if (!clock || !particles) return; const currentTime = clock.getElapsedTime(); for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; if (!p || !p.userData || p.userData.birthTime === undefined) { particles.splice(i, 1); continue; } const age = currentTime - p.userData.birthTime; if (age > p.userData.life) { if (scene) scene.remove(p); particles.splice(i, 1); continue; } p.position.addScaledVector(p.userData.direction, p.userData.speed); p.userData.speed *= 0.98; p.userData.direction.y += p.userData.gravity; const lifeRatio = 1.0 - (age / p.userData.life); const scale = Math.max(0.01, lifeRatio * 0.8 + 0.2); p.scale.set(scale, scale, scale); }
}
// --- Camera Shake ---
let shakeIntensity = 0; let shakeDuration = 0; let shakeStartTime = 0; const originalCameraPos = new THREE.Vector3();
function triggerCameraShake(intensity, durationMs) { if (!clock) return; if (shakeIntensity > 0 && intensity < shakeIntensity) return; shakeIntensity = intensity; shakeDuration = durationMs / 1000; shakeStartTime = clock.getElapsedTime(); if(camera) originalCameraPos.copy(camera.position); }
function updateCameraShake(deltaTime) { if (!clock || !camera) return; if (shakeIntensity > 0) { const elapsedTime = clock.getElapsedTime() - shakeStartTime; if (elapsedTime > shakeDuration) { shakeIntensity = 0; if(camera.position.distanceTo(originalCameraPos) > 0.01 && originalCameraPos.lengthSq() > 0) { camera.position.copy(originalCameraPos); } } else { const shakeFactor = 1.0 - (elapsedTime / shakeDuration); const shakeAmount = shakeIntensity * shakeFactor; const offsetX = (Math.random() - 0.5) * shakeAmount; const offsetY = (Math.random() - 0.5) * shakeAmount; camera.position.copy(originalCameraPos).add(new THREE.Vector3(offsetX, offsetY, 0)); } } else if (camera.position.distanceTo(originalCameraPos) > 0.01 && originalCameraPos.lengthSq() > 0) { camera.position.lerp(originalCameraPos, 0.1); } }

// --- Score, Speed, Game Over, UI ---
function updateScore() { if(scoreElement) scoreElement.textContent = `Score: ${score}`; }
function updateAmmoUI() { if(ammoElement) ammoElement.textContent = `Ammo: ${ammoCount}`; } // Nova função para UI de munição
function increaseSpeed() { if (gameSpeed < maxGameSpeed) { gameSpeed += speedIncreaseFactor * (1 + score * 0.0001); gameSpeed = Math.min(gameSpeed, maxGameSpeed); } }
function gameOver() { if (isGameOver) return; isGameOver = true; gameRunning = false; console.log("Game Over!"); showMessage(`GAME OVER! Score: ${score}`); playSound('gameOver'); stopMusic(); triggerCameraShake(0.5, 1000); updateEngineSound(); // Para o som do motor
    // Limpa timer da caixa de munição se estiver ativo
    if (ammoBoxSpawnTimer) {
        clearTimeout(ammoBoxSpawnTimer);
        ammoBoxSpawnTimer = null;
    }
    isWaitingForAmmoBox = false;
}

// --- RESTART GAME ---
function restartGame() {
    console.log("--- RESTARTING GAME ---");
    // 1. Parar Processos Ativos
    gameRunning = false;
    isGameOver = false;
    stopMusic();
    if (engineNode && audioContext && audioContext.state === 'running' && engineGain) {
        try {
             engineGain.gain.cancelScheduledValues(audioContext.currentTime);
             engineGain.gain.setValueAtTime(engineGain.gain.value, audioContext.currentTime);
             engineGain.gain.linearRampToValueAtTime(0.0, audioContext.currentTime + 0.05);
         } catch(e) { console.warn("Error fading engine sound:", e); }
    }
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    // Limpar timer da caixa de munição (redundante, mas seguro)
    if (ammoBoxSpawnTimer) {
        clearTimeout(ammoBoxSpawnTimer);
        ammoBoxSpawnTimer = null;
    }
    isWaitingForAmmoBox = false;


    // 2. Limpar Visuais
    disposeSceneContents(scene); // Remove a caixa de munição também, se existir
    disposeSharedAssets();
    if (renderer) {
         renderer.dispose();
         renderer = null;
    }

    // 3. Resetar Variáveis de Estado (já feito em resetGameState, chamado por initThree)
    // Limpando aqui explicitamente para garantir, antes do setTimeout
    zombies = []; projectiles = []; particles = []; roadSegments = []; roadsideObjects = [];
    bus = null; busBoundingBox = null;
    ammoBox = null; // Garante que a ref da caixa seja limpa
    score = 0; gameSpeed = 0.15; targetBusLane = 0; ammoCount = maxAmmo;


    // 4. Re-inicializar e Começar
    setTimeout(() => {
         console.log("Re-initializing...");
        initAudio();
        initThree(); // Recria tudo e chama resetGameState internamente
         if (!isGameOver && scene && renderer && camera) {
            gameRunning = true;
            if (!clock) clock = new THREE.Clock(); // Garante que o clock exista
            lastFireTime = clock.getElapsedTime() * 1000; // Reseta cooldown tiro
            if (!animationFrameId) animate();
            console.log("--- RESTART COMPLETE ---");
        } else {
             console.error("--- RESTART FAILED: Init incomplete ---");
             // Poderia mostrar uma mensagem de erro na UI aqui
             showMessage("Restart Failed! Please Refresh.");
        }
    }, 50);

    hideMessage();
}

function disposeSceneContents(sceneToClean) {
    if (!sceneToClean) { console.log("DisposeScene: Scene is null."); return; }
     console.log("Disposing scene contents...");
    for (let i = sceneToClean.children.length - 1; i >= 0; i--) {
         const obj = sceneToClean.children[i];
         sceneToClean.remove(obj);

         if (obj === ammoBox) { // Limpa a referência global se o objeto removido for a caixa
             ammoBox = null;
         }

         if (obj instanceof THREE.Mesh || obj instanceof THREE.Group || obj instanceof THREE.Line) {
             obj.traverse(child => {
                 if (child.isMesh) {
                     // Não dispose geometrias/materiais shared aqui
                     // Apenas dispose materiais que NÃO são shared
                     if (child.material && !isMaterialShared(child.material)) {
                         disposeMaterial(child.material); // Função helper agora verifica
                     }
                     // Apenas dispose geometrias que NÃO são shared
                     if (child.geometry && !isGeometryShared(child.geometry)) {
                         child.geometry.dispose();
                     }
                 }
             });
         } else if (obj instanceof THREE.Light) {
            if (obj.dispose) obj.dispose(); // Algumas luzes têm dispose (ex: shadow maps)
         }
     }
      console.log("Scene contents disposed.");
}

// Funções Helper para verificar se geo/mat são compartilhados
function isMaterialShared(material) {
    return material === sharedZombieSkinMat || material === sharedZombieClothesMat ||
           material === sharedParticleMatRed1 || material === sharedParticleMatRed2 ||
           material === sharedParticleMatGreen || material === sharedAmmoBoxMat;
}

function isGeometryShared(geometry) {
    return geometry === sharedZombieTorsoGeo || geometry === sharedZombieHeadGeo ||
           geometry === sharedZombieArmGeo || geometry === sharedZombieLegGeo ||
           geometry === sharedParticleGeo || geometry === sharedAmmoBoxGeo;
}

function disposeMaterial(material) {
    if (!material || isMaterialShared(material)) return; // Não dispose shared
    // Dispose texturas se existirem e não forem compartilhadas (nenhuma textura não compartilhada no momento)
    for (const key of Object.keys(material)) {
        const value = material[key];
        if (value && typeof value === 'object' && value.isTexture) {
            // Adicionar verificação se a textura é compartilhada se necessário no futuro
            value.dispose();
        }
    }
    material.dispose();
}

// --- UI and Controls ---
function showMessage(text) { if(messageText) messageText.innerHTML = text.replace('Score:', '<br>Score:'); if(messageBox) messageBox.style.display = 'block'; }
function hideMessage() { if(messageBox) messageBox.style.display = 'none'; }
function handleKeyDown(event) { if (isGameOver || !gameRunning || !clock) return; const currentTime = clock.getElapsedTime(); switch (event.key) { case 'ArrowLeft': case 'a': case 'A': if (targetBusLane > -1) { targetBusLane--; } break; case 'ArrowRight': case 'd': case 'D': if (targetBusLane < 1) { targetBusLane++; } break; case ' ': /* A lógica de tiro agora está em createProjectileEnhanced */ createProjectileEnhanced(); break; } }
function onWindowResize() { if (!camera || !renderer) return; const newWidth = window.innerWidth; const newHeight = window.innerHeight; camera.aspect = newWidth / newHeight; camera.updateProjectionMatrix(); renderer.setSize(newWidth, newHeight); const baseFontSize = Math.min(newWidth * 0.015, newHeight * 0.02, 18); if (scoreElement && scoreElement.parentNode) { scoreElement.parentNode.style.fontSize = `${baseFontSize}px`; } }

// --- Animation Loop ---
function animate() {
    animationFrameId = requestAnimationFrame(animate);
    if(!clock || !renderer || !scene || !camera) { console.error("Core component missing in animate loop."); return; }
    const deltaTime = clock.getDelta();

    if (gameRunning && !isGameOver) {
        try {
            updateRoad(deltaTime);
            updateRoadsideObjects();
            updateZombies(deltaTime);
            updateProjectiles();
            updateBusPosition();
            updateParticles(deltaTime);
            updateAmmoBox(deltaTime); // <<< Adiciona atualização da caixa de munição
            checkCollisions();
            increaseSpeed();
        } catch (e) { console.error("Error during game update:", e); gameOver(); /* Considera game over em erro grave */ }
    }
     try {
        updateEngineSound(); updateCameraShake(deltaTime);
     } catch (e) { console.error("Error during post-logic update:", e); }
     try {
        renderer.render(scene, camera);
     } catch (e) { console.error("Error during rendering:", e); if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; } gameOver(); /* Game over em erro de render */ }
}

// --- Start ---
mainInit();