import * as THREE from 'three';

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

    session.updateRenderState({
        baseLayer: new XRWebGLLayer(session, gl)
    });

    const referenceSpaceTypes: XRReferenceSpaceType[] = [
        'local',
        'local-floor',
        'bounded-floor',
        'unbounded',
        'viewer'
    ];

    let referenceSpace: XRReferenceSpace | null = null;

    for (const spaceType of referenceSpaceTypes) {
        try {
            referenceSpace = await session.requestReferenceSpace(spaceType);
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

    // Create a render loop that allows us to draw on the AR view.
    const onXRFrame = (time: number, frame: XRFrame) => {
        // Queue up the next draw request.
        session.requestAnimationFrame(onXRFrame);
    
        const baseLayer = session.renderState.baseLayer;
        if (!baseLayer) return;
    
        gl.bindFramebuffer(gl.FRAMEBUFFER, baseLayer.framebuffer)
    
        const pose = frame.getViewerPose(referenceSpace);
        if (pose) {
            const view = pose.views[0];
    
            const viewport = baseLayer.getViewport(view);
            if (!viewport) return;
            renderer.setSize(viewport.width, viewport.height)
    
            // Use the view's transform matrix and projection matrix to configure the THREE.camera.
            camera.matrix.fromArray(view.transform.matrix)
            camera.projectionMatrix.fromArray(view.projectionMatrix);
            camera.updateMatrixWorld(true);
    
            // Render the scene with THREE.WebGLRenderer.
            renderer.render(scene, camera)
        }
    }

    session.requestAnimationFrame(onXRFrame);
}

// Make the function available globally
(window as any).activateXR = activateXR; 