const button=document.getElementById('bStart'),status=document.getElementById('bootStatus');
button.disabled=true;
const ready=new MutationObserver(()=>{
 if(document.body.dataset.qa){button.disabled=false;status.remove();ready.disconnect()}
});
ready.observe(document.body,{attributes:true,attributeFilter:['data-qa']});
function failure(message){
 status.textContent='场景未能装载。请刷新后重试。';
 const error=document.getElementById('err');error.style.display='block';
 error.textContent=location.protocol==='file:'?'请勿直接双击 HTML。启动第四版预览后打开 http://127.0.0.1:5190/river/。':'场景装载失败：'+message;
}
addEventListener('unhandledrejection',e=>failure(e.reason?.message||String(e.reason)));
if(location.protocol==='file:')failure('需要 HTTP 服务');
