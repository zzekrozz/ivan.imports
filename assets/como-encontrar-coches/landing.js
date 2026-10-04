
(function(){var s=document.getElementById('sc'),N='http://www.w3.org/2000/svg',r=7;function R(){r=(r*9301+49297)%233280;return r/233280}
function E(n,a){var e=document.createElementNS(N,n);for(var k in a)e.setAttribute(k,a[k]);s.appendChild(e);return e}
function X(km){return 60+km/200*460}function Y(p){return 330-p/16*300}
E('path',{d:'M'+X(10)+' '+Y(15.2)+'L'+X(190)+' '+Y(6.2)+'L'+X(190)+' '+Y(8.6)+'L'+X(10)+' '+Y(17.8)+'Z',fill:'#1d6ff2','fill-opacity':.12});
for(var i=0;i<26;i++){var k=15+R()*170,p=16.5-k*.054+(R()-.5)*2.6;E('circle',{cx:X(k),cy:Y(p),r:6,fill:'#51627f','fill-opacity':.55})}
var c=E('circle',{cx:X(78),cy:Y(9.6),r:11,fill:'#1f9d6b',stroke:'#fff','stroke-width':3});
var t=E('text',{x:X(78)+18,y:Y(9.6)+26,fill:'#1f9d6b','font-size':20,'font-weight':700,'font-family':'Barlow Condensed'});t.textContent='Tu candidato, por debajo del rango';
var u=E('text',{x:X(110),y:Y(15.4),fill:'#1d6ff2','font-size':16,'font-weight':600,'font-family':'Barlow'});u.textContent='Rango de venta razonable'})();

// Hero visible => sticky oculto; también durante ambos cierres de compra.
const sticky=document.querySelector(".rev-sticky");
const hero=document.querySelector(".rev-hero");
const prices=[...document.querySelectorAll(".rev-pricing")];
if(sticky&&hero&&prices.length&&"IntersectionObserver" in window){
 const update=()=>{sticky.hidden=hero.getBoundingClientRect().bottom>0||prices.some(node=>{const box=node.getBoundingClientRect();return box.top<innerHeight&&box.bottom>0;});};
 const observer=new IntersectionObserver(update,{threshold:0});
 [hero,...prices].forEach(node=>observer.observe(node));
 window.addEventListener("resize",update);update();
}
