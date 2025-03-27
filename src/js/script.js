let cursor = document.querySelector(".cursor");
document.addEventListener("mousemove", function(dets){
    cursor.style.left = dets.pageX+"px"
    cursor.style.top = dets.pageY+"px"
})