/**
 * Initiate AOS
 */

$(window).on('load', function () {
    aos_init()
});

function aos_init() {
    AOS.init({
        duration: 1000,
        once: true
    });
}

/**
 * Initiate glightbox
 */
const glightbox = GLightbox({
    selector: '.glightbox'
});