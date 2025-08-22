
    
self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.5.0/math.min.js');
const linspace=(start,end,num)=>{if(num===0)return[];if(num<=1)return[start];const t=(end-start)/(num-1);return Array.from({length:num},(_,r)=>start+t*r)};



self.onmessage=function(e){
    const t=e.data;
    try{
        let r;
        switch(t.mode){
            case"surface":r=generateSurfaceData(t);break;
            case"vector":r=generateVectorData(t);break;
            case"parametric":r=generateParametricData(t);break;
            case"curve":r=generateParametricCurveData(t);break;
   

        }
        self.postMessage({status:"success",data:r.data,stats:r.stats,id:t.id})
    }catch(r){
        self.postMessage({status:"error",message:r.message,id:t.id})
    }
};

function generateSurfaceData({equation:e,xMin:t,xMax:r,yMin:a,yMax:n,quality:o,xMaxOverride:i,yMaxOverride:l,scope:s}){const c=void 0!==i?i:r,d=void 0!==l?l:n,p=linspace(t,c,o),m=linspace(a,d,o),h=math.parse(e).compile(),f=[],g=[];let u=1/0,v=-1/0;for(const e of m)for(const t of p)try{const r=h.evaluate({...s,x:t,y:e});isFinite(r)?(f.push(t,e,r),g.push(r),r<u&&(u=r),r>v&&(v=r)):(f.push(t,e,0),g.push(NaN))}catch(err){f.push(t,e,0),g.push(NaN)}const w=[];for(let e=0;e<o-1;e++)for(let t=0;t<o-1;t++){const r=e*o+t,a=r+1,n=r+o,s=n+1;w.push(r,n,a),w.push(a,n,s)}return{data:{vertices:new Float32Array(f),indices:new Uint32Array(w),values:new Float32Array(g),width:o,height:o,zMin:u,zMax:v},stats:{dataPoints:o*o}}}
function generateVectorData({fx:e,fy:t,fz:r,xMin:a,xMax:n,yMin:o,yMax:s,zMin:i,zMax:l,density:c,xMaxOverride:d,yMaxOverride:p,zMaxOverride:h,scope:m}){const g=void 0!==d?d:n,f=void 0!==p?p:s,q=void 0!==h?h:l,v=linspace(a,g,c),b=linspace(o,f,c),w=linspace(i,q,c),y=math.parse(e).compile(),x=math.parse(t).compile(),E=math.parse(r).compile(),M=[],S=c*c*c;let z=1/0,A=-1/0;for(const e of v)for(const t of b)for(const r of w)try{const a={...m,x:e,y:t,z:r},n=y.evaluate(a),o=x.evaluate(a),s=E.evaluate(a);if([n,o,s].every(isFinite)){const i=Math.sqrt(n*n+o*o+s*s);i>1e-6&&(i<z&&(z=i),i>A&&(A=i),M.push({origin:{x:e,y:t,z:r},components:{x:n,y:o,z:s},mag:i}))}}catch(err){}z===1/0&&(z=0);const V={vectors:M,minMag:z,maxMag:A,domain:{xMin:a,xMax:n,yMin:o,yMax:s,zMin:i,zMax:l},density:c};return{data:V,stats:{dataPoints:M.length}}}
function generateParametricData({xExpr:e,yExpr:t,zExpr:r,uMin:a,uMax:n,vMin:o,vMax:s,quality:i,uMaxOverride:c,vMaxOverride:d,scope:p}){const h=void 0!==c?c:n,m=void 0!==d?d:s,f=linspace(a,h,i),g=linspace(o,m,i),q=math.parse(e).compile(),v=math.parse(t).compile(),b=math.parse(r).compile(),w=[],y=[];let x=1/0,E=-1/0;for(const e of g)for(const t of f)try{const r={...p,u:t,v:e},a=q.evaluate(r),n=v.evaluate(r),o=b.evaluate(r);[a,n,o].every(isFinite)?(w.push(a,n,o),y.push(o),o<x&&(x=o),o>E&&(E=o)):(w.push(0,0,0),y.push(NaN))}catch(err){w.push(0,0,0),y.push(NaN)}const M=[];for(let e=0;e<i-1;e++)for(let t=0;t<i-1;t++){const r=e*i+t,a=r+1,n=r+i,o=n+1;M.push(r,n,a),M.push(a,n,o)}return{data:{vertices:new Float32Array(w),indices:new Uint32Array(M),values:new Float32Array(y),width:i,height:i,zMin:x,zMax:E},stats:{dataPoints:i*i}}}
function generateParametricCurveData({xExpr:e,yExpr:t,zExpr:r,tMin:a,tMax:n,quality:o,tMaxOverride:i,scope:l}){const c=void 0!==i?i:n,s=linspace(a,c,o),d=math.parse(e).compile(),p=math.parse(t).compile(),h=math.parse(r).compile(),m=[],f=[];for(const e of s)try{const t={...l,t:e},r=d.evaluate(t),n=p.evaluate(t),a=h.evaluate(t);[r,n,a].every(isFinite)&&(m.push(r,n,a),f.push(e))}catch(err){}return{data:{vertices:new Float32Array(m),values:new Float32Array(f),tMin:a,tMax:c},stats:{dataPoints:m.length/3}}}

