
import * as three from '../node_modules/three/build/three.module.js';

import appCss from './app.css';
import back from './back2.jpeg';
import frontTextrue from './front_texture.png';
import rightTexture from './right_texture.png';
import backTexture from './back_texture.png';
import leftTexture from './left_texture.png';
import topTexture from './top_texture.png';
import bottomTexture from './bottom_texture.png';

const unit = 15;
const wall = Object.freeze({
  top:[0, unit, 0],
  front:[0, 0, unit],
  right:[-unit, 0, 0],
  back:[0, 0, -unit],
  left:[unit, 0, 0],
  bottom:[0, -unit, 0]
});

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
    this.renderer = new three.WebGLRenderer({antialias:true});
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.scene = new three.Scene();
    this.scene.depth = true;

    this.cubeCamera1 = this.initCubeCamera(this.scene);
    this.camera =  new three.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 
      1, 1000);
    const position = [0, 0, 10];
    this.camera.position.set(...position);
    this.cameraDistance = Math.sqrt(position.reduce((sum, cur) => sum + cur * cur));
    this.backgroundUrl = back;
    this.lon = 0;
    this.lat = 0;
    this.phi = 0;
    this.theta = 0;

    this.onPointerDownPointerX=0;
    this.onPointerDownPointerY=0;
    this.onPointerDownLon=0;
    this.onPointerDownLat=0;

    this.mouse = new three.Vector2();
    this.raycaster = new three.Raycaster();
    this.INTERSECTED = undefined;
  }
  initCubeCamera(scene) {
    const cubeCamera = new three.CubeCamera(3, 1000, 256);
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

  insertFlatShape(scene, whichWall=wall.front, materailConfig={color:0x00ff00} , selectedCaller,position=[0,0], size=[1, 1]) {
    let [width, height] = size;
    let [x, y] = position;
    let shape = new three.Shape();
    shape.moveTo(x, y);
    shape.lineTo(x+width, y);
    shape.lineTo(x+width, y+height);
    shape.lineTo(x, y+height);
    shape.lineTo(x, y);
    const matrix = new three.Matrix4();
    const rotation = new three.Matrix4();
    const scale = new three.Matrix4();
    scale.makeScale(unit, unit, unit);
    const [tx, ty, tz] = whichWall;
    !!tx && rotation.makeRotationY(-Math.PI * tx / unit / 2);
    !!ty && rotation.makeRotationX(Math.PI * (ty / unit / 2 ));
    !!tz && rotation.makeRotationY(Math.PI * (tz / unit + 1) /2);
    matrix.makeTranslation(tx, ty, tz);
    matrix.multiply(rotation);
    matrix.multiply(scale);
    if (materailConfig.map) {
      materailConfig.map.wrapS = three.ClampToEdgeWrapping;
      materailConfig.map.wrapT = three.ClampToEdgeWrapping;
    }
    const shapeGeometry = new three.ShapeGeometry(shape);
    shapeGeometry.applyMatrix(matrix);
    const material = new three.MeshBasicMaterial(materailConfig);
    const shapeMesh = new three.Mesh(shapeGeometry, material);
    shapeMesh.selectedCaller = selectedCaller || (() => {console.log('not define the click event: selectedCaller')})
    scene.add(shapeMesh);
  }
  
  begin() {
    const loadBackground = this.loadTexture(back);
    const loadtop = this.loadTexture(topTexture);
    const loadfront = this.loadTexture(frontTextrue);
    const loadright = this.loadTexture(rightTexture);
    const loadback = this.loadTexture(backTexture);
    const loadleft = this.loadTexture(leftTexture);
    const loadbottom = this.loadTexture(bottomTexture);
    return Promise.all([loadBackground, loadtop, loadfront, loadright, loadback,loadleft, loadbottom]).then(textureArray => {
      const backgroundTexture = textureArray[0];
      const options = {
        resolution: 1024,
        generateMipmaps: true,
        minFilter: three.LinearMipMapLinearFilter,
        magFilter: three.LinearFilter
      };

      this.scene.background = new CubeMapGenerator(this.renderer).fromEquirectangular(backgroundTexture, options);

      const cubeTexture = textureArray[1];
      this.insertFlatShape(this.scene, wall.top, {map:textureArray[1]});
      this.insertFlatShape(this.scene, wall.front, {map:textureArray[2]}, ()=> {
        console.log('this is insert a flat shape when');
      });
      this.insertFlatShape(this.scene, wall.right, {map:textureArray[3]});
      this.insertFlatShape(this.scene, wall.back, {map:textureArray[4]});
      this.insertFlatShape(this.scene, wall.left, {map:textureArray[5]});
      this.insertFlatShape(this.scene, wall.bottom, {map:textureArray[6]});

      document.addEventListener('mousedown', this.onDocumentMouseDown.bind(this), false);
      document.addEventListener('touchstart', this.onDocumentTouchStart.bind(this), false);
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

  onDocumentTouchStart(touchEvent) {
    touchEvent.preventDefault();
    const event = touchEvent.touches[touchEvent.touches.length - 1];
    this.onPointerDownPointerX = event.clientX;
    this.onPointerDownPointerY = event.clientY;
    this.onPointerDownLon = this.lon;
    this.onPointerDownLat = this.lat;
    document.addEventListener( 'touchmove', this.onDocumentTouchMove.bind(this), false );
    document.addEventListener( 'touchleave', this.onDocumentMouseUp.bind(this), false );
  }
  onDocumentTouchMove( touchEvent ) {
    // event.preventDefault();
    const event = touchEvent.touches[touchEvent.touches.length - 1];
    this.lon = ( event.clientX - this.onPointerDownPointerX ) * 0.1 + this.onPointerDownLon;
    this.lat = ( event.clientY - this.onPointerDownPointerY ) * 0.1 + this.onPointerDownLat;
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    // this.mouse.x = (this.lon / window.innerWidth) * 2 - 1;
    // this.mouse.y = (this.lat / window.height) * 2 - 1;
  }

  onDocumentTouchLeave() {
    document.removeEventListener( 'touchmove', this.onDocumentTouchMove.bind(this), false );
    document.removeEventListener( 'touchleave', this.onDocumentTouchLeave.bind(this), false );
    if(this.INTERSECTED && this.INTERSECTED.selectedCaller) {
      this.INTERSECTED.selectedCaller();
    }
  }

  onDocumentMouseMove( event ) {
    this.lon = ( event.clientX - this.onPointerDownPointerX ) * 0.1 + this.onPointerDownLon;
    this.lat = ( event.clientY - this.onPointerDownPointerY ) * 0.1 + this.onPointerDownLat;
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  onDocumentMouseUp() {
    document.removeEventListener( 'mousemove', this.onDocumentMouseMove.bind(this), false );
    document.removeEventListener( 'mouseup', this.onDocumentMouseUp.bind(this), false );
    if(this.INTERSECTED && this.INTERSECTED.selectedCaller) {
      this.INTERSECTED.selectedCaller();
    }
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
    // var time = Date.now();
    // this.lon += .15;

    this.lat = Math.max( - 85, Math.min( 85, this.lat ) );
    this.phi = three.Math.degToRad( 90 - this.lat );
    this.theta = three.Math.degToRad( this.lon );

    this.camera.position.x = this.cameraDistance * Math.sin( this.phi ) * Math.cos( this.theta );
    this.camera.position.y = this.cameraDistance * Math.cos( this.phi );
    this.camera.position.z = this.cameraDistance * Math.sin( this.phi ) * Math.sin( this.theta );

    this.camera.lookAt( this.scene.position );
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects( this.scene.children );
    if ( intersects.length > 0 ) {
      if ( this.INTERSECTED != intersects[ 0 ].object ) {
        if ( this.INTERSECTED ) this.INTERSECTED.material.emissive.setHex( this.INTERSECTED.currentHex );
        this.INTERSECTED = intersects[ 0 ].object;
        this.INTERSECTED.currentHex = this.INTERSECTED.material.color.getHex();
        this.INTERSECTED.material.color.setHex( 0xff0000 );
      }
    } else {
      if ( this.INTERSECTED ) this.INTERSECTED.material.color.setHex( this.INTERSECTED.currentHex );
      this.INTERSECTED = null;
    }
    this.renderer.render( this.scene, this.camera );

  }


}

let hasrun = false;
const run = () => {
  hasrun = true;
  window.onload = () => {
    const myScene = new MyScene();
    myScene.begin();
  };
};

export default {
  run
};
if (!hasrun) {
  run();
}
