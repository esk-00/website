import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, cassetteModel;
let lockedTape = null; // 現在クリックして出ているテープを保持

window.addEventListener("DOMContentLoaded", () => {
    const slider = document.getElementById("volumeSlider");
    const playBtn = document.getElementById("playBtn");
    const screen = document.querySelector(".rec-screen");
    let audioContext, noiseSource, gainNode, started = false;

    // --- 音声ロジック ---
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

    // ノイズを完全に止める関数
    function stopNoise() {
        if (noiseSource) {
            noiseSource.stop();
            noiseSource = null; // 参照を消して完全に停止
        }
        if (audioContext) {
            audioContext.suspend();
        }
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
            // フェードアウトしてから停止
            if (gainNode) {
                gainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.5);
            }
            
            screen.style.transition = "opacity 1.5s ease";
            screen.style.opacity = 0;
            
            setTimeout(() => {
                screen.style.display = "none";
                stopNoise(); // ここで確実にノイズを消す
                startThree();
            }, 1500);
        });
    }

    // --- Three.js メイン ---
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

        scene.add(new THREE.AmbientLight(0xffffff, 2.5));
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(30, 20, 10);
        scene.add(dirLight);

        const loader = new GLTFLoader();
        loader.load("./models/player_case.glb", (gltf) => {
            cassetteModel = gltf.scene;
            
            const box = new THREE.Box3().setFromObject(cassetteModel);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const mScale = 15 / Math.max(size.x, size.y, size.z);
            
            cassetteModel.scale.set(mScale, mScale, mScale);
            cassetteModel.position.set(-center.x * mScale - 0.5, -center.y * mScale - 2.5, -center.z * mScale);
            cassetteModel.rotation.x = Math.PI / 2;

            // 枠線の描画（しきい値60で文字ノイズを回避）
            cassetteModel.traverse((node) => {
                if (node.isMesh) {
                    node.material.side = THREE.DoubleSide;
                    const edges = new THREE.EdgesGeometry(node.geometry, 60);
                    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000 }));
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
        labelItems.forEach((item) => {
            const targetName = item.getAttribute('data-target');
            const target = cassetteModel.getObjectByName(targetName);
            if (!target) return;
            
            target.userData.originalY = target.position.y;
            const outPosition = target.userData.originalY + 1.0;

            // ホバー：ロックされていなければ動かす
            item.addEventListener('mouseenter', () => {
                if (lockedTape !== target) {
                    target.position.y = outPosition;
                }
            });

            item.addEventListener('mouseleave', () => {
                if (lockedTape !== target) {
                    target.position.y = target.userData.originalY;
                }
            });

            // クリック：トグル処理
            item.addEventListener('click', () => {
                // すでにこれが出ているなら、戻す
                if (lockedTape === target) {
                    target.position.y = target.userData.originalY;
                    lockedTape = null;
                } 
                // 別のテープが出ているなら、それを戻してこれを出せ
                else {
                    if (lockedTape) {
                        lockedTape.position.y = lockedTape.userData.originalY;
                    }
                    target.position.y = outPosition;
                    lockedTape = target;
                }
            });
        });
    }
});