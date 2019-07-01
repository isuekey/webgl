
import * as three from '../node_modules/three/build/three.module.js';

class CubeMapGenerator {
  constructor(renderer) {
    this.renderer = renderer;
  }
  fromEquirectangular(texture, options={}) {
    const scene = new three.Scene();
    const shader = {
      uniforms:{tEquirect:{value:null}},
      vertexShader:`
			varying vec3 vWorldDirection;

			//include <common>
			vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
				return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

			}
			void main() {

				vWorldDirection = transformDirection( position, modelMatrix );

				#include <begin_vertex>
				#include <project_vertex>

			}
			`,
      fragmentShader:`
        uniform sampler2D tEquirect;

        varying vec3 vWorldDirection;

        //include <common>
        #define RECIPROCAL_PI 0.31830988618
        #define RECIPROCAL_PI2 0.15915494

        void main() {
          vec3 direction = normalize( vWorldDirection );
          vec2 sampleUV;
          sampleUV.y = asin( clamp( direction.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
          sampleUV.x = atan( direction.z, direction.x ) * RECIPROCAL_PI2 + 0.5;
          gl_FragColor = texture2D( tEquirect, sampleUV );
        }
			`
    };
    const material = new three.ShaderMaterial({
      type:'CubemapFromEquirect',
      uniforms: three.UniformsUtils.clone(shader.uniforms),
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
      side: three.BackSide,
      blending: three.NoBlending
    });
    material.uniforms.tEquirect.value = texture;
    const mesh = new three.Mesh(new three.BoxBufferGeometry(5, 5, 5), material);
    scene.add(mesh);
    const resolution = options.resolution || 512;
    const params = {
      type: texture.type,
      format: texture.format,
      encoding: texture.encoding,
      generateMipmaps: options.generateMipmaps || texture.generateMipmaps,
      minFilter: options.minFilter || texture.minFilter,
      magFilter: options.magFilter || texture.magFilter
    };
    const camera = new three.CubeCamera(1, 10, resolution, params);
    camera.update(this.renderer, scene);
    mesh.geometry.dispose();
    mesh.material.dispose();
    return camera.renderTarget;
  }
}

class MyScene {
  constructor() {
    this.renderer = new three.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.scene = new three.Scene();
    this.scene.depth = true;

    this.cubeCamera1 = this.initCubeCamera(this.scene);
    this.cubeCamera2 = this.initCubeCamera(this.scene);
    this.camera =  new three.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 
      1, 1000);
    const position = [0, 0, 4];
    this.camera.position.set(...position);
    this.cameraDistance = Math.sqrt(position.reduce((sum, cur) => sum + cur * cur));
    this.mpaUrl = './src/nx.png';
    this.backgroundUrl = './src/back2.jpeg';
    this.lon = 0;
    this.lat = 0;
    this.phi = 0;
    this.theta = 0;

    this.onPointerDownPointerX=0;
    this.onPointerDownPointerY=0;
    this.onPointerDownLon=0;
    this.onPointerDownLat=0;
  }
  initCubeCamera(scene) {
    const cubeCamera = new three.CubeCamera(1, 1000, 256);
    cubeCamera.renderTarget.texture.generateMipmaps = true;
    cubeCamera.renderTarget.texture.minFilter = three.LinearMipMapLinearFilter;
    scene.add(cubeCamera);
    return cubeCamera;
  }

  loadTexture(textureUrl, loader= new three.TextureLoader()) {
    return new Promise((resolve, reject) => {
      loader.load(textureUrl, resolve, reject);
    });
  }
  
  begin() {
    const loadBackground = this.loadTexture(this.backgroundUrl);
    const loadCubeTexture = this.loadTexture(this.mpaUrl);
    return Promise.all([loadBackground, loadCubeTexture]).then(textureArray => {
      const backgroundTexture = textureArray[0];
      const options = {
        resolution: 1024,

        generateMipmaps: true,
        minFilter: three.LinearMipMapLinearFilter,
        magFilter: three.LinearFilter
      };
      this.scene.background = new CubeMapGenerator(this.renderer).fromEquirectangular(backgroundTexture, options);

      const cubeTexure = textureArray[1];
      cubeTexure.wrapS = three.RepeatWrapping;
      cubeTexure.wrapT = three.RepeatWrapping;

      const material = new three.MeshBasicMaterial({map: cubeTexure});
      const geometry = new three.BoxGeometry(1, 1, 1);
      const cube = new three.Mesh(geometry, material);
      cube.rotation.x = Math.PI/ 5;
      cube.rotation.y = Math.PI/ 5;
      this.scene.add(cube);
      // this.camera.position.z = 0;
      document.addEventListener('mousedown', this.onDocumentMouseDown.bind(this), false);
      document.addEventListener('wheel', this.onDocumentMouseWheel.bind(this), false);

      window.addEventListener('resize', this.onWindowResized.bind(this), false);
      return this.scene;
    }).then(() => {
      this.animate();
    });
  }
  onWindowResized() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth/window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  onDocumentMouseDown(event) {
    event.preventDefault();
    this.onPointerDownPointerX = event.clientX;
    this.onPointerDownPointerY = event.clientY;
    this.onPointerDownLon = this.lon;
    this.onPointerDownLat = this.lat;
    document.addEventListener( 'mousemove', this.onDocumentMouseMove.bind(this), false );
    document.addEventListener( 'mouseup', this.onDocumentMouseUp.bind(this), false );
  }

  onDocumentMouseMove( event ) {
    this.lon = ( event.clientX - this.onPointerDownPointerX ) * 0.1 + this.onPointerDownLon;
    this.lat = ( event.clientY - this.onPointerDownPointerY ) * 0.1 + this.onPointerDownLat;
  }

  onDocumentMouseUp() {
    document.removeEventListener( 'mousemove', this.onDocumentMouseMove.bind(this), false );
    document.removeEventListener( 'mouseup', this.onDocumentMouseUp.bind(this), false );

  }

  onDocumentMouseWheel( event ) {
    var fov = this.camera.fov + event.deltaY * 0.05;
    this.camera.fov = three.Math.clamp( fov, 10, 75 );
    this.camera.updateProjectionMatrix();
  }

  animate() {
    requestAnimationFrame( this.animate.bind(this) );
    this.render();
  }
  render() {
    var time = Date.now();
    this.lon += .15;

    this.lat = Math.max( - 85, Math.min( 85, this.lat ) );
    this.phi = three.Math.degToRad( 90 - this.lat );
    this.theta = three.Math.degToRad( this.lon );

    // this.cube.position.x = Math.cos( time * 0.001 ) * 30;
    // this.cube.position.y = Math.sin( time * 0.001 ) * 30;
    // this.cube.position.z = Math.sin( time * 0.001 ) * 30;

    // this.cube.rotation.x += 0.02;
    // this.cube.rotation.y += 0.03;

    // this.torus.position.x = Math.cos( time * 0.001 + 10 ) * 30;
    // this.torus.position.y = Math.sin( time * 0.001 + 10 ) * 30;
    // this.torus.position.z = Math.sin( time * 0.001 + 10 ) * 30;

    // this.torus.rotation.x += 0.02;
    // this.torus.rotation.y += 0.03;
    // console.log('this.cameraDistance', this.cameraDistance);

    this.camera.position.x = this.cameraDistance * Math.sin( this.phi ) * Math.cos( this.theta );
    this.camera.position.y = this.cameraDistance * Math.cos( this.phi );
    this.camera.position.z = this.cameraDistance * Math.sin( this.phi ) * Math.sin( this.theta );

    this.camera.lookAt( this.scene.position );

    // this.sphere.visible = false;

    // pingpong

    // if ( this.count % 2 === 0 ) {

    //   this.material.envMap = this.cubeCamera1.renderTarget.texture;
    //   this.cubeCamera2.update( this.renderer, this.scene );

    // } else {

    //   this.material.envMap = this.cubeCamera2.renderTarget.texture;
    //   this.cubeCamera1.update( this.renderer, this.scene );

    // }

    // this.count ++;

    // this.sphere.visible = true;

    this.renderer.render( this.scene, this.camera );

  }


}


const run = () => {
  window.onload = () => {
    const myScene = new MyScene();
    myScene.begin();
  };
};

export default {
  run
};

