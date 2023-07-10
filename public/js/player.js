function getAjax(offset)
{
	$.ajax({
		url : '/watch?v='+window.location.href.substr(-32)+'&offset='+offset,
		type : "GET",
		dataType:'json',
		success : function(response) {
			for(var i=0;i<response.length;i++){
				document.getElementsByClassName('play-list')[0].innerHTML+='<a href="/watch?v='+response[i].uniqueid+'"><div class="card"><div class="image"><img onerror="this.style.display=\'none\'" src="'+response[i].img+'"></div><div class="details"><h3 class="title">'+response[i].name+'</h3><p class="all"> Rating :'+response[i].rating+' , Year :'+response[i].year+'</p><p class="all">'+response[i].genre.split(',').join(', ')+'</p></div></div></a>';
			}
		}
	});
}
function suggestion(){
	var offset = 0;
	getAjax(0);
	$(window).scroll(function() {
	var pos=$(window).scrollTop();
	var bottom=$(document).height()-$(window).height();
		if(pos>=bottom-50) {
			offset+=20;
			getAjax(offset);
		}
	});
}

$(document).on('click', function (e) {
	if ($(e.target).closest(".fa-bars").length === 0) {
		$(".nav-outer-container").hide();
	}
});