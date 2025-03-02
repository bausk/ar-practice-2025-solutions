import * as THREE from 'three';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MODE = 'immersive-ar';

async function activateXR(): Promise<void> {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    
    const gl = canvas.getContext("webgl2", {xrCompatible: true});
    if (!gl) throw new Error("WebGL not supported");

    const scene = new THREE.Scene();

    const materials = [
        new THREE.MeshBasicMaterial({color: 0xff0000}),
        new THREE.MeshBasicMaterial({color: 0x0000ff}),
        new THREE.MeshBasicMaterial({color: 0x00ff00}),
        new THREE.MeshBasicMaterial({color: 0xff00ff}),
        new THREE.MeshBasicMaterial({color: 0x00ffff}),
        new THREE.MeshBasicMaterial({color: 0xffff00})
    ];

    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), materials);
    cube.position.set(1, 1, 1);
    scene.add(cube);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight.position.set(10, 15, 10);
    scene.add(directionalLight);

    const renderer = new THREE.WebGLRenderer({
        alpha: true,
        preserveDrawingBuffer: true,
        canvas: canvas,
        context: gl
    });
    renderer.autoClear = false;

    const camera = new THREE.PerspectiveCamera();
    camera.matrixAutoUpdate = false;

    if (!navigator.xr) {
        throw new Error("WebXR is not supported by your browser");
    }

    try {
        const supported = await navigator.xr.isSessionSupported(MODE);
        if (!supported) {
            throw new Error(`${MODE} mode is not supported by your browser/device`);
        }
    } catch (e) {
        throw new Error('Error checking WebXR support: ' + e);
    }

    const session = await navigator.xr.requestSession(
        MODE,
        {
            requiredFeatures: [
                'local',
                'hit-test'
            ]
        }
    );

    const baseLayer = new XRWebGLLayer(session, gl);

    session.updateRenderState({
        baseLayer
    });

    const referenceSpaceTypes: XRReferenceSpaceType[] = [
        'local',
    ];

    let referenceSpace: XRReferenceSpace | null = null;
    let hitTestSource: XRHitTestSource | undefined = undefined;

    for (const spaceType of referenceSpaceTypes) {
        try {
            referenceSpace = await session.requestReferenceSpace(spaceType);
            const viewerSpace = await session.requestReferenceSpace('viewer');
            
            if (session.requestHitTestSource) {
                hitTestSource = await session.requestHitTestSource({ space: viewerSpace });   
            }
            console.log('Reference space established:', spaceType);
            break;
        } catch(e) {
            console.log(e);
            console.log('Reference space failed:', spaceType);
            continue;
        }
    }

    if (!referenceSpace) {
        throw new Error('No reference space could be established');
    }

    const loader = new GLTFLoader();
    let reticle: any;
    loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf", function(gltf) {
      reticle = gltf.scene;
      reticle.visible = false;
      scene.add(reticle);
    })
    
    let flower: any;
    loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/sunflower/sunflower.gltf", function(gltf) {
      flower = gltf.scene;
    });

    session.addEventListener("select", (event) => {
        if (flower) {
          const clone = flower.clone();
          clone.position.copy(reticle.position);
          scene.add(clone);
        }
      });
    // Create a render loop that allows us to draw on the AR view.
    const onXRFrame = (time: number, frame: XRFrame) => {
        // Queue up the next draw request.
        session.requestAnimationFrame(onXRFrame);
    
        const baseLayer = session.renderState.baseLayer;
        if (!baseLayer) return;
    
        gl.bindFramebuffer(gl.FRAMEBUFFER, baseLayer.framebuffer)
    
        const pose = frame.getViewerPose(referenceSpace);
        if (pose && hitTestSource) {
            const view = pose.views[0];
    
            const viewport = baseLayer.getViewport(view);
            if (!viewport) return;
            renderer.setSize(viewport.width, viewport.height)
    
            // Use the view's transform matrix and projection matrix to configure the THREE.camera.
            camera.matrix.fromArray(view.transform.matrix)
            camera.projectionMatrix.fromArray(view.projectionMatrix);
            camera.updateMatrixWorld(true);
    
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            if (hitTestResults.length > 0 && reticle) {
                const hitPose = hitTestResults[0].getPose(referenceSpace);
                reticle.visible = true;
                reticle.position.set(hitPose?.transform.position.x, hitPose?.transform.position.y, hitPose?.transform.position.z)
                reticle.updateMatrixWorld(true);
            }
            // Render the scene with THREE.WebGLRenderer.
            renderer.render(scene, camera)
        }
    }

    session.requestAnimationFrame(onXRFrame);
}

// Make the function available globally
(window as any).activateXR = activateXR;
