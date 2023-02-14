const cursor = document.querySelector('.cursor');

document.addEventListener('mousemove', e => {
    cursor.setAttribute("style", "top: "+(e.pageY - 10)+"px; left: "+(e.pageX - 10)+"px;")
})

document.addEventListener('click', () => {
    cursor.classList.add("expand");

    setTimeout(() => {
        cursor.classList.remove("expand");
    }, 500)
})

var item = document.getElementsByTagName("a");
item.forEach(item => {
    item.addEventListener('mouseover', () => {
        cursor.classList.add("hover");
    })
    
    item.addEventListener('mouseout', () => {
        cursor.classList.remove("hover");
    })
    
});