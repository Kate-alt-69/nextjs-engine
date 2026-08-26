import type { ECGroup, ECMesh, ECNode, ECScene, ECTransform } from "./ECTypes";
import type { ECRenderContext, RenderingEngine } from "./RenderingEngine";
export class Engine2D implements RenderingEngine {
	public readonly name="2d"; public readonly contextType="2d" as const; private ctx:CanvasRenderingContext2D|null=null; private width=0; private height=0;
	public init(context:ECRenderContext):void{if(!context.ctx2d)throw new Error("[Engine2D] A 2D canvas context is required.");this.ctx=context.ctx2d;this.width=context.width;this.height=context.height}
	public resize(width:number,height:number):void{this.width=width;this.height=height}
	public render(scene:ECScene):void{const ctx=this.ctx;if(!ctx)return;ctx.clearRect(0,0,this.width,this.height);if(scene.environment!=="void"&&scene.background){ctx.fillStyle=scene.background;ctx.fillRect(0,0,this.width,this.height)}ctx.save();ctx.translate(this.width/2,this.height/2);for(const node of scene.children)this.renderNode(ctx,node);ctx.restore()}
	private renderNode(ctx:CanvasRenderingContext2D,node:ECNode):void{node.type==="group"?this.renderGroup(ctx,node):this.renderMesh(ctx,node)}
	private renderGroup(ctx:CanvasRenderingContext2D,group:ECGroup):void{ctx.save();this.applyTransform(ctx,group.transform);for(const child of group.children)this.renderNode(ctx,child);ctx.restore()}
	private applyTransform(ctx:CanvasRenderingContext2D,t:ECTransform):void{ctx.translate(t.position.x,t.position.y);ctx.rotate(t.rotation.z*Math.PI/180);ctx.scale(t.scale.x,t.scale.y)}
	private traceTriangle(ctx:CanvasRenderingContext2D,v:Float32Array,a:number,b:number,c:number):void{ctx.beginPath();ctx.moveTo(v[a*3],v[a*3+1]);ctx.lineTo(v[b*3],v[b*3+1]);ctx.lineTo(v[c*3],v[c*3+1]);ctx.closePath()}
	private paint(ctx:CanvasRenderingContext2D,mesh:ECMesh):void{const m=mesh.material;if(m.shading==="rim"&&m.rimColor){ctx.save();ctx.strokeStyle=m.rimColor;ctx.lineWidth=(m.strokeWidth??1)+4;ctx.globalAlpha=(m.opacity??1)*(m.rimIntensity??.5);ctx.stroke();ctx.restore()}ctx.globalAlpha=m.opacity??1;if(m.fill){ctx.fillStyle=m.fill;ctx.fill()}if(m.stroke){ctx.strokeStyle=m.stroke;ctx.lineWidth=m.strokeWidth??1;ctx.stroke()}}
	private renderMesh(ctx:CanvasRenderingContext2D,mesh:ECMesh):void{ctx.save();this.applyTransform(ctx,mesh.transform);const v=mesh.vertices;if(mesh.topology==="strip"){ctx.beginPath();for(let i=0;i<v.length;i+=3)i===0?ctx.moveTo(v[i],v[i+1]):ctx.lineTo(v[i],v[i+1]);this.paint(ctx,{...mesh,material:{...mesh.material,fill:undefined}});ctx.restore();return}const count=v.length/3;const tris:Array<[number,number,number]>=[];if(mesh.indices){for(let i=0;i+2<mesh.indices.length;i+=3)tris.push([mesh.indices[i],mesh.indices[i+1],mesh.indices[i+2]])}else if(mesh.topology==="fan"){for(let i=1;i+1<count;i++)tris.push([0,i,i+1])}else{for(let i=0;i+2<count;i+=3)tris.push([i,i+1,i+2])}for(const [a,b,c] of tris){this.traceTriangle(ctx,v,a,b,c);this.paint(ctx,mesh)}ctx.restore()}
	public dispose():void{this.ctx=null}
}
