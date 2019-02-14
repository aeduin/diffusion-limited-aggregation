// initialize variables and constants
const main_screen = document.getElementById("main_screen");

const screen_size = { width: main_screen.width, height: main_screen.height };
const outside_world = 300;
const world_border = {
    left: -outside_world,
    right: main_screen.width + outside_world,
    top: -outside_world,
    bottom: main_screen.height + outside_world,
    width: 0,
    height: 0,
};

world_border.width = world_border.right - world_border.left;
world_border.height = world_border.bottom - world_border.top;

const number_of_particles = 20000;
const radius = 2;
const speed_scale = 1.3;
const random_walk = false;
var draw_moving = false;
const replace_after_touch = true;

let fractal_size = {
    left: (world_border.left + world_border.right) / 2,
    right: (world_border.left + world_border.right) / 2,
    top: (world_border.top + world_border.bottom) / 2,
    bottom: (world_border.top + world_border.bottom) / 2,
}

let static_map = [];

for(let i = 0; i < (Math.abs(world_border.left) + Math.abs(world_border.right)) * (Math.abs(world_border.top) + Math.abs(world_border.bottom)); i++) {
    static_map[i] = [];
}

// define some functions

class Particle {
    constructor(is_static = false) {
        this.is_static = is_static;

        if(is_static) {
            this.x = world_border.width / 2 + world_border.left;
            this.y = fractal_size.top;
        }
        else {
            // set random location outside of the fractal borders
            let fractal_width = fractal_size.right - fractal_size.left;
            let fractal_height = fractal_size.bottom - fractal_size.top;

            this.x = world_border.left + Math.random() * (world_border.width - fractal_width);
            this.y = world_border.top + Math.random() * (world_border.height - fractal_height);
            if(this.x > fractal_size.left) {
                this.x += fractal_width;
            }
            if(this.y > fractal_size.top) {
                this.y += fractal_height;
            }
        }

        this.radius = radius;

        this.delta_x = speed_scale * (Math.random() * 2 - 1);
        this.delta_y = speed_scale * (Math.random() * 2 - 1);
    }

    move() {
        if(random_walk) {
            this.x += speed_scale * (Math.random() * 2 - 1);
            this.y += speed_scale * (Math.random() * 2 - 1);
        }
        else {
            this.x += this.delta_x;
            this.y += this.delta_y;
        }

        // check if the particle is still inside the world

        const left = this.x - this.radius;
        const right = this.x + this.radius;
        const top = this.y - this.radius;
        const bottom = this.y + this.radius;
    

        if(right > world_border.right) {
            this.x = world_border.right - radius;
            this.delta_x *= -1;
        }
        if(bottom > world_border.bottom) {
            this.y = world_border.bottom - radius;
            this.delta_y *= -1;
        }
        if(left < world_border.left) {
            this.x = world_border.left + radius;
            this.delta_x *= -1;
        }
        if(top < world_border.top) {
            this.y = world_border.top + radius;
            this.delta_y *= -1;
        }
    }

    collide(other) {
        const horizontal_distance = this.x - other.x;
        const vertical_distance = this.y - other.y;
        const distance_squared = horizontal_distance * horizontal_distance + vertical_distance * vertical_distance;
        const radius_sum = this.radius + other.radius;

        return distance_squared <= radius_sum * radius_sum;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.radius, this.radius, Math.PI / 4, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    }
}



function add_static(particle) {
    static_particles.push(particle);

    const left = particle.x - particle.radius;
    const right = particle.x + particle.radius;
    const top = particle.y - particle.radius;
    const bottom = particle.y + particle.radius;

    // update fractal_size
    if(left < fractal_size.left) {
        fractal_size.left = left;
    }
    if(right > fractal_size.right) {
        fractal_size.right = right;
    }
    if(top < fractal_size.top) {
        fractal_size.top = top;
    }
    if(bottom > fractal_size.bottom) {
        fractal_size.bottom = bottom;
    }

    // update static_map
    for(let x = Math.floor(left); x < Math.ceil(right); x++) {
        for(let y = Math.floor(top); y < Math.ceil(bottom); y++) {
            static_map[(x - world_border.left) + (y - world_border.top) * world_border.width].push(particle);
        }
    }

    // draw on the static_particles_canvas
    const heuristic = Math.sqrt(static_particles.length) / 2 + 10;//Math.log2(static_particles.length / 10) * 10 + 100;
    
    static_particles_ctx.fillStyle = `rgb(${brightness_mapper(heuristic * 2)}, ${brightness_mapper(heuristic * 3)}, ${brightness_mapper(heuristic * 5)})`
    static_particles_ctx.beginPath();
    static_particles_ctx.ellipse(particle.x, particle.y, particle.radius, particle.radius, Math.PI / 4, 0, Math.PI * 2);
    static_particles_ctx.closePath();
    static_particles_ctx.fill();
}

function brightness_mapper(input) {
    input = input % 256;
    if(input < 128) {
        return input * 2;
    }
    else {
        return 512 - input * 2;
    }
}

let counter = 0;
let total_elapsed_time = 0;

function main_loop() {
    const now = performance.now();

    // update all particles

    for(let particle of moving_particles) {
        particle.move();
    }

    // the array with particles that are going from moving to static state
    let transferring_particles = [];

    for(let i = 0; i < moving_particles.length; i++) {
        const moving_particle = moving_particles[i];

        const left = moving_particle.x - moving_particle.radius;
        const right = moving_particle.x + moving_particle.radius;
        const top = moving_particle.y - moving_particle.radius;
        const bottom = moving_particle.y + moving_particle.radius;

        if(right < fractal_size.left && left > fractal_size.right &&
            bottom < fractal_size.top && top > fractal_size.bottom) {
            // the particle is to far away from the static particles
            continue;
        }

        // the array with static particles close enough
        let map_matches = [];
        
        for(let x = Math.floor(left); x < Math.ceil(right); x++) {
            for(let y = Math.floor(top); y < Math.ceil(bottom); y++) {
                const static_here = static_map[(x - world_border.left) + (y - world_border.top) * world_border.width];
                
                if(static_here.length > 0) {
                    map_matches.push(...static_here);  
                }          
            }
        }

        if(map_matches.length < 1) {
            // there are no static particles here
            continue;
        }

        for(let static_particle of map_matches) {
            if(moving_particle.collide(static_particle)) {
                // it passed all the collision tests
                transferring_particles.push({ index: i, particle: moving_particle })
                break;
            }
        }
    }

    // if the particles aren't replaced, moving_particles.splice will be called. sort so that this happens in the right order
    if(!replace_after_touch) {
        transferring_particles.sort((first, second) => first.index < second.index);
    }

    //transfer transfering_particles from moving to static particles
    for(let transfer of transferring_particles) {
        add_static(transfer.particle);

        transfer.particle.is_static = true;

        if(replace_after_touch) {
            moving_particles[transfer.index] = new Particle();
        }
        else {
            moving_particles.splice(transfer.index, 1);
        }        
    }

    // draw
    main_ctx.drawImage(static_particles_canvas, 0, 0);

    if(draw_moving) {
        for(let particle of moving_particles) {
            particle.draw(main_ctx);
        }
    }

    //finish up
    console.log(performance.now() - now);

    if(fractal_size.left > world_border.left || fractal_size.right < world_border.right || fractal_size.top > world_border.top || fractal_size.bottom < world_border.bottom) {
        requestAnimationFrame(main_loop);
    }
    else {
        console.log("done!");
    }
}

// intialize canvases (one is the main_screen, the other only contains the static particles)
const main_ctx = main_screen.getContext("2d");

const static_particles_canvas = document.createElement("canvas");
static_particles_canvas.width = screen_size.width;
static_particles_canvas.height = screen_size.height;
const static_particles_ctx = static_particles_canvas.getContext("2d");
static_particles_ctx.fillStyle = "#1F1F3F";
static_particles_ctx.fillRect(0, 0, screen_size.width, screen_size.height);

main_ctx.fillStyle = "white";

// initialize particles
let moving_particles = [];
for(let i = 0; i < number_of_particles; i++) {
    moving_particles[i] = new Particle();
}

let static_particles = [];

add_static(new Particle(true));

// run the simulation!
main_loop();