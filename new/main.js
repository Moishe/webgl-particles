"use strict";

var gl;
var pixels = [];
var iH;
var iW;
var canvas;

const maxAge = 100;

const initialActors = 10000;
const maxPixels = 100000;
var numPixels = 0;

var actors = [];
var deposits;

function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  canvas = document.querySelector("#canvas");
  gl = canvas.getContext("experimental-webgl");

  if (!gl) {
    alert("There's no WebGL context available.");
    return;
  }

  // setup GLSL program
  var program = webglUtils.createProgramFromScripts(gl, ["vertex-shader-2d", "fragment-shader-2d"]);

  // look up where the vertex data needs to go.
  var positionAttributeLocation = gl.getAttribLocation(program, "a_position");

  // look up uniform locations
  var resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");

  // Create a buffer to put three 2d clip space points in
  var positionBuffer = gl.createBuffer();

  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  webglUtils.resizeCanvasToDisplaySize(gl.canvas);

  // Tell WebGL how to convert from clip space to pixels
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  // Clear the canvas
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Tell it to use our program (pair of shaders)
  gl.useProgram(program);

  // Turn on the attribute
  gl.enableVertexAttribArray(positionAttributeLocation);

  // Bind the position buffer.
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  for (var i = 0; i < maxPixels; i++) {
    pixels.push(0); // x
    pixels.push(0); // y
    pixels.push(0); // a
  }

  pixels = new Float32Array(pixels);

  // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  var size = 3;          // 3 components per iteration
  var type = gl.FLOAT;   // the data is 32bit floats
  var normalize = false; // don't normalize the data
  var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0;        // start at the beginning of the buffer
  gl.vertexAttribPointer(
      positionAttributeLocation, size, type, normalize, stride, offset);

  // set the resolution
  gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);

  initializeDeposits();

  animate();  
}

function initializeActors() {
  for (var i = 0; i < initialActors; i++) {
    actors[i] = {
      'position': [randomInt(iW), randomInt(iH)],
      'direction': Math.random() * Math.PI * 2,
      'speed': 1,
      'age': randomInt(10)
    }
  }
}

function initializeDeposits() {
  // This is a little weird because it ends up initializing the deposit
  // data asynchronously, after we've already started processing the
  // actors and drawing their trails. This is okay because the actors
  // will start moving towards (and mutating) these deposits when they exist.

  var img = new Image();
  img.src = 'first3.jpg';
  var hiddenCanvas = document.getElementById('hidden-canvas'),
      context = hiddenCanvas.getContext('2d');

  img.onload = function() {
    var hRatio = canvas.width / img.width;
    var vRatio = canvas.height / img.height;
    var ratio  = Math.min ( hRatio, vRatio );
    
    iH = Math.floor(img.height * ratio);
    iW = Math.floor(img.width * ratio);
  
    context.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width * ratio, img.height * ratio);
    var data = context.getImageData(0, 0, img.width, img.height).data;

    deposits = [];
    for (var i = 0; i < iH * iW; i++) {
      var v = 0; //(data[i * 3] + data[i * 3 + 1], data[i * 3 + 2]) / (255.0 * 3.0);
      deposits.push(v)
    }

    deposits = new Float32Array(deposits);

    initializeActors();
  }
}

function animate() {
  requestAnimationFrame(animate);
  processActors();
  drawScene();
}

const lookDirection = Math.PI / 3;
const lookMomentum = 1.1;

function getMoveCoords(actor, distance, direction) {
  var look_x = actor['position'][0] + distance * Math.cos(actor['direction'] + direction);
  var look_y = actor['position'][1] + distance * Math.sin(actor['direction'] + direction);
  return [look_x, look_y];
}

function getDepositValue(coords) {
  var deposit_idx = Math.floor(coords[0]) + Math.floor(coords[1]) * iW;
  return deposits[deposit_idx];
}

function getDirectionalValues(actor) {
  var lcoords = getMoveCoords(actor, 1, -lookDirection);
  var lv = getDepositValue(lcoords);

  var rcoords = getMoveCoords(actor, 1, lookDirection);
  var rv = getDepositValue(rcoords);

  var mcoords = getMoveCoords(actor, 1, 0);
  var mv = getDepositValue(mcoords);

  return {'lv': lv, 'mv': mv, 'rv': rv};
}

function incrementDepositValue(coords, amount) {
  var deposit_idx = coords[0] + coords[1] * iW;
  deposits[deposit_idx] += 0.1;
}

function processActors() {
  if (!deposits) {
    return;
  }

  var new_actors = [];
  var idx = 0;

  actors.forEach(actor => {
    if (idx < maxPixels) {
      var new_actor = {
        'position': [],
        'speed': actor['speed'],
        'direction': actor['direction']
      }
      var {lv, mv, rv} = getDirectionalValues(actor);
      var dr;
      if (lv > mv && lv > rv) {
        dr = -1;
      } else if (rv > mv && rv > lv) {
        dr = 1
      } else {
        dr = 0;
      }
      new_actor['direction'] += dr * lookDirection * lookMomentum;;
      pixels[idx * 3] = actor['position'][0];       // x
      pixels[idx * 3 + 1] = actor['position'][1];   // y

      pixels[idx * 3 + 2] = getDepositValue(actor['position']);
      incrementDepositValue(actor['position'], Math.max(lv, mv, rv));

      new_actor['position'][0] = actor['position'][0] + new_actor['speed'] * Math.cos(new_actor['direction']);
      new_actor['position'][1] = actor['position'][1] + new_actor['speed'] * Math.sin(new_actor['direction']);

      if (new_actor['position'][0] > 0 &&
          new_actor['position'][0] < iW &&
          new_actor['position'][1] > 1 &&
          new_actor['position'][1] < iH) {
        new_actors.push(new_actor);
      }
    }
    idx++;
    actors = new_actors;
  })

  actors = new_actors;
  numPixels = Math.min(maxPixels, idx);
}

function drawScene() {
  if (numPixels == 0) {
    return;
  }

  gl.bufferData(gl.ARRAY_BUFFER, pixels, gl.DYNAMIC_DRAW);

  var primitiveType = gl.POINTS;
  var offset = 0;
  var count = numPixels;
  gl.drawArrays(primitiveType, offset, count);
}

// Returns a random integer from 0 to range - 1.
function randomInt(range) {
  return Math.floor(Math.random() * range);
}

window.onload = main;