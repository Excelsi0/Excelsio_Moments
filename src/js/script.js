let cursor = document.querySelector(".cursor");
document.addEventListener("mousemove", function(dets){
    cursor.style.left = dets.pageX+"px"
    cursor.style.top = dets.pageY+"px"
})
if ('ontouchstart' in window || navigator.maxTouchPoints) {
  document.querySelector('.cursor').style.display = 'none';
}

