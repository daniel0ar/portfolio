function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  rectMode(CENTER);
  canvas.style('z-index', '-1');
  if (windowWidth > 768) {
    canvas.position(230, 0);
  }
  else {
    canvas.position(0, -900);
  }
}

let angle1 = 0;
let angle2 = 0;
let scalar = 40;


function draw() {
  background("#ffffff");

  let ang1 = radians(angle1);
  let ang2 = radians(angle2);

  let x1 = width / 2 + scalar * cos(ang1);
  let x2 = width / 2 + scalar * cos(ang2);

  let y1 = height / 2 + scalar * sin(ang1);
  let y2 = height / 2 + scalar * sin(ang2);

  fill(8, 140, 220, 0);
  noStroke()
  rect(width * 0.5, height * 0.5, 140, 140);

  fill(0, 102, 153);
  ellipse(x1, height * 0.5 - 120, scalar, scalar);
  ellipse(x2, height * 0.5 + 120, scalar, scalar);

  fill(255, 204, 0);
  ellipse(width * 0.5 - 120, y1, scalar, scalar);
  ellipse(width * 0.5 + 120, y2, scalar, scalar);

  angle1 += 2;
  angle2 += 3;
}
