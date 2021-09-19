"use strict";

var gl;
var colors = [];
var pixels = [];
var iH;
var iW;
var canvas;

const maxAge = 100;

const initialActors = 10;
const maxPixels = 100000;
var numPixels = 0;

var actors = [];
var deposits;
var trail = [];

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

  for (var i = 0; i < maxPixels; i++) {
    colors.push(i / maxPixels)
    colors.push(i / maxPixels)
    colors.push(i / maxPixels)
    colors.push(1)  
  }

  colors = new Float32Array(colors);
  
  var colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
  
  var colorsLocation = gl.getAttribLocation(program, "colors");
  gl.vertexAttribPointer(colorsLocation, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(colorsLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

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
    pixels.push(0);
    pixels.push(0);
  }

  pixels = new Float32Array(pixels);

  // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  var size = 2;          // 2 components per iteration
  var type = gl.FLOAT;   // the data is 32bit floats
  var normalize = false; // don't normalize the data
  var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0;        // start at the beginning of the buffer
  gl.vertexAttribPointer(
      positionAttributeLocation, size, type, normalize, stride, offset);

  // set the resolution
  gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);

  initializeActors();
  initializeDeposits();

  animate();  
}

function initializeActors() {
  for (var i = 0; i < initialActors; i++) {
    actors[i] = {
      'position': [randomInt(gl.canvas.width), randomInt(gl.canvas.height)],
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
    
    iH = img.height * ratio;
    iW = img.width * ratio;
  
    context.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width * ratio, img.height * ratio);
    var data = context.getImageData(0, 0, img.width, img.height).data;
    deposits = data;
  }
}

function animate() {
  requestAnimationFrame(animate);
  processActors();
  drawScene();
}

function processActors() {
  var idx = 0;
  var new_actors = [];
  actors.forEach(actor => {
    if (idx < maxPixels) {
      pixels[idx * 2] = actor['position'][0];
      pixels[idx * 2 + 1] = actor['position'][1];

      if ((Math.random() * maxPixels) > Math.max(idx, numPixels)) {
        var new_actor = {
          'position' : [], 
          'direction': actor['direction'] + (Math.random() - 0.5) * 0.4, 
          'speed': actor['speed'] * 1.8 + 1,
          'age': 50 + randomInt(100)
        };

        for (var i = 0; i < 2; i++) {
          new_actor['position'][i] = actor['position'][i];
        }

        //new_actor['age'] = 50; //getStartingSpeedFromPosition(actor['position']);
        new_actors.push(new_actor);
        colors[idx * 4] = actor['age'];
        colors[idx * 4 + 1] = actor['age'];
        colors[idx * 4 + 2] = 255 - actor['age'];
      }

      // are there any pheromones along the direction we're looking?
      var s = 4; actor['speed'];
      var d = actor['direction'];
      actor['position'][0] += s * Math.cos(d);
      actor['position'][1] += s * Math.sin(d);

      if (actor['position'][0] > 0 &&
          actor['position'][1] > 0 &&
          actor['position'][0] < gl.canvas.width &&
          actor['position'][1] < gl.canvas.height &&
          actor['age'] > 0) {
        actor['age'] -= 1;
        new_actors.push(actor);
      }
    }

    idx++;
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