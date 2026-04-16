import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { UIController } from './ui-controller.js';

let scene, camera, renderer, cassetteModel;
let lockedTape = null; 
const ui = new UIController();

window.addEventListener("DOMContentLoaded", () => {
    const slider = document.getElementById("volumeSlider");
    const playBtn = document.getElementById("playBtn");
    const screen = document.querySelector(".rec-screen");
    let audioContext, noiseSource, gainNode, started = false;

    // --- 音声ロジック (省略なし) ---
    async function initAudio() {
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') await audioContext.resume();
        if (!noiseSource) {
            const bufferSize = audioContext.sampleRate * 2;
            const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
            noiseSource = audioContext.createBufferSource();
            noiseSource.buffer = noiseBuffer;
            noiseSource.loop = true;
            gainNode = audioContext.createGain();
            gainNode.gain.value = slider ? slider.value * 0.1 : 0;
            noiseSource.connect(gainNode);
            gainNode.connect(audioContext.destination);
            noiseSource.start();
            started = true;
        }
    }

    function stopNoise() {
        if (noiseSource) { noiseSource.stop(); noiseSource = null; }
        if (audioContext) { audioContext.suspend(); }
    }

    if (slider) {
        slider.addEventListener("input", async () => {
            if (!started) await initAudio();
            if (gainNode) gainNode.gain.setTargetAtTime(slider.value * 0.1, audioContext.currentTime, 0.01);
        });
    }

    if (playBtn) {
        playBtn.addEventListener("click", async () => {
            if (!started) await initAudio();
            if (gainNode) gainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.5);
            screen.style.transition = "opacity 1.5s ease";
            screen.style.opacity = 0;
            setTimeout(() => {
                screen.style.display = "none";
                stopNoise(); 
                startThree();
            }, 1500);
        });
    }

    if (ui.closeBtn) {
        ui.closeBtn.onclick = () => {
            ui.closePanel();
            if (lockedTape) {
                lockedTape.position.y = lockedTape.userData.originalY;
                lockedTape = null;
            }
        };
    }

    // loading.js (シャドウノイズ修正版)

// ... (音声ロジック等はそのまま、startThreeまで飛ばします) ...

function startThree() {
    const canvas = document.getElementById("webgl");
    canvas.style.display = "block";

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x708A8C); 
    camera = new THREE.PerspectiveCamera(10, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 75);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    // --- 【超重要】影の種類をより滑らかなものに変更 ---
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 

    // --- ライティング ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.6)); 
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight.position.set(5.5, 3.5, 8.5); // 影が綺麗に出る位置
    dirLight.castShadow = true;
    
    // 影の範囲設定 (ここはあなたのコードを維持)
    dirLight.shadow.camera.left = -10;
    dirLight.shadow.camera.right = 10;
    dirLight.shadow.camera.top = 10;
    dirLight.shadow.camera.bottom = -10;

    // --- 【ここが解決策】影の計算のズレ（bias）を調整する ---
    dirLight.shadow.bias = -0.00005; // わずかに影を浮かせることで、自分自身の影（ノイズ）を消す
    dirLight.shadow.mapSize.width = 2048; // 影の解像度を上げて綺麗に
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.radius = 1; // 影の縁を少しぼかして自然に

    scene.add(dirLight);

    // --- 3D背景（板）の追加 ---
    const bgGeometry = new THREE.PlaneGeometry(2048, 2048);
    const bgMaterial = new THREE.MeshToonMaterial({ color: 0x47585a });
    const backgroundPlane = new THREE.Mesh(bgGeometry, bgMaterial);
    backgroundPlane.position.z = -10;
    backgroundPlane.receiveShadow = true; // 影を受ける
    scene.add(backgroundPlane);

    new GLTFLoader().load("./models/player_case.glb", (gltf) => {
        cassetteModel = gltf.scene;
        
        // --- (配置ロジックはあなたの元の数値を維持) ---
        const box = new THREE.Box3().setFromObject(cassetteModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const mScale = 15 / Math.max(size.x, size.y, size.z);
        cassetteModel.scale.set(mScale, mScale, mScale);
        cassetteModel.position.set(-center.x * mScale - 0.5, -center.y * mScale - 2.5, -center.z * mScale);
        cassetteModel.rotation.x = Math.PI / 2;

        cassetteModel.traverse((node) => {
            if (node.isMesh) {
                // 真っ白回避のため、既存の質感をベースに調整
                node.material.flatShading = true;
                node.material.metalness = 0.1;
                node.material.roughness = 0.8;
                node.castShadow = true; // モデルが影を落とす
                node.receiveShadow = true;

                // --- 輪郭線の調整 ---
                const edges = new THREE.EdgesGeometry(node.geometry, 57.5);
                const line = new THREE.LineSegments(
                    edges,
                    new THREE.LineBasicMaterial({
                        color: 0x000000,
                        linewidth: 2,
                        transparent: true,
                        opacity: 0.5 // 線を少し透けさせて馴染ませる
                    })
                );
                node.add(line);
            }
        });

        scene.add(cassetteModel);
        updateRackScale();
        setupHoverEvents();
    });

        function animate() {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        }
        animate();

        function updateRackScale() {
            const rackElement = document.querySelector('.cassette-rack-labels');
            if (!rackElement) return;
            const currentScale = window.innerWidth / 1920;
            rackElement.style.setProperty('--rack-scale', currentScale);
        }

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            updateRackScale();
        });
    }

    function setupHoverEvents() {
        const labelItems = document.querySelectorAll('.label-item');
        const tapeInfo = {
            about: { title: "ABOUT ME", artist: "USER", image: "./images/about.jpg" },
            works: { title: "WORKS", artist: "CREATION", image: "./images/works.jpg" },
            skill: { title: "SKILLS", artist: "DEV", image: "./images/skill.jpg" },
            playground: { title: "PLAYGROUND", artist: "LAB", image: "./images/play.jpg" },
            appendix: { title: "APPENDIX", artist: "EXTRA", image: "./images/extra.jpg" },
            contact: { title: "CONTACT", artist: "MAIL", image: "./images/contact.jpg" }
        };

        labelItems.forEach((item) => {
            const targetName = item.getAttribute('data-target');
            const target = cassetteModel.getObjectByName(targetName);
            if (!target) return;
            
            // 初回時に元の位置を保存
            if (target.userData.originalY === undefined) {
                target.userData.originalY = target.position.y;
            }
            const outPosition = target.userData.originalY + 1.0;

            item.addEventListener('mouseenter', () => {
                if (lockedTape !== target) target.position.y = outPosition;
            });

            item.addEventListener('mouseleave', () => {
                if (lockedTape !== target) target.position.y = target.userData.originalY;
            });

            item.addEventListener('click', () => {
                // すでにこのテープがロックされている場合 -> 解除
                if (lockedTape === target) {
                    target.position.y = target.userData.originalY;
                    lockedTape = null;
                    ui.closePanel();
                } 
                // 別のテープがロックされている、または何もロックされていない場合 -> 新しくロック
                else {
                    // もし他にロックされているテープがあれば、それを先に元の位置に戻す
                    if (lockedTape) {
                        lockedTape.position.y = lockedTape.userData.originalY;
                    }
                    
                    target.position.y = outPosition;
                    lockedTape = target;
                    const data = tapeInfo[targetName] || { title: targetName.toUpperCase(), artist: "UNKNOWN" };
                    ui.openPanel(data);
                }
            });
        });

        // パネル側の閉じるボタン(x)を押した時の連動処理も追加
        if (ui.closeBtn) {
            ui.closeBtn.onclick = () => {
                ui.closePanel();
                if (lockedTape) {
                    lockedTape.position.y = lockedTape.userData.originalY;
                    lockedTape = null;
                }
            };
        }
    }
});