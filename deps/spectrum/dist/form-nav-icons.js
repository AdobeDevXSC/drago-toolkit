function A(s,t){window.__swc,customElements.define(s,t)}var Y=globalThis,X=Y.ShadowRoot&&(Y.ShadyCSS===void 0||Y.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,At=Symbol(),Vt=new WeakMap,B=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==At)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o,e=this.t;if(X&&t===void 0){let i=e!==void 0&&e.length===1;i&&(t=Vt.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&Vt.set(e,t))}return t}toString(){return this.cssText}},jt=s=>new B(typeof s=="string"?s:s+"",void 0,At),bt=(s,...t)=>{let e=s.length===1?s[0]:t.reduce((i,r,o)=>i+(n=>{if(n._$cssResult$===!0)return n.cssText;if(typeof n=="number")return n;throw Error("Value passed to 'css' function must be a 'css' function result: "+n+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(r)+s[o+1],s[0]);return new B(e,s,At)},Zt=(s,t)=>{if(X)s.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(let e of t){let i=document.createElement("style"),r=Y.litNonce;r!==void 0&&i.setAttribute("nonce",r),i.textContent=e.cssText,s.appendChild(i)}},xt=X?s=>s:s=>s instanceof CSSStyleSheet?(t=>{let e="";for(let i of t.cssRules)e+=i.cssText;return jt(e)})(s):s;var{is:Re,defineProperty:ke,getOwnPropertyDescriptor:Le,getOwnPropertyNames:Ne,getOwnPropertySymbols:He,getPrototypeOf:ze}=Object,J=globalThis,Gt=J.trustedTypes,De=Gt?Gt.emptyScript:"",Be=J.reactiveElementPolyfillSupport,V=(s,t)=>s,j={toAttribute(s,t){switch(t){case Boolean:s=s?De:null;break;case Object:case Array:s=s==null?s:JSON.stringify(s)}return s},fromAttribute(s,t){let e=s;switch(t){case Boolean:e=s!==null;break;case Number:e=s===null?null:Number(s);break;case Object:case Array:try{e=JSON.parse(s)}catch{e=null}}return e}},Q=(s,t)=>!Re(s,t),qt={attribute:!0,type:String,converter:j,reflect:!1,useDefault:!1,hasChanged:Q};Symbol.metadata??=Symbol("metadata"),J.litPropertyMetadata??=new WeakMap;var E=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=qt){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){let i=Symbol(),r=this.getPropertyDescriptor(t,i,e);r!==void 0&&ke(this.prototype,t,r)}}static getPropertyDescriptor(t,e,i){let{get:r,set:o}=Le(this.prototype,t)??{get(){return this[e]},set(n){this[e]=n}};return{get:r,set(n){let l=r?.call(this);o?.call(this,n),this.requestUpdate(t,l,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??qt}static _$Ei(){if(this.hasOwnProperty(V("elementProperties")))return;let t=ze(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(V("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(V("properties"))){let e=this.properties,i=[...Ne(e),...He(e)];for(let r of i)this.createProperty(r,e[r])}let t=this[Symbol.metadata];if(t!==null){let e=litPropertyMetadata.get(t);if(e!==void 0)for(let[i,r]of e)this.elementProperties.set(i,r)}this._$Eh=new Map;for(let[e,i]of this.elementProperties){let r=this._$Eu(e,i);r!==void 0&&this._$Eh.set(r,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){let e=[];if(Array.isArray(t)){let i=new Set(t.flat(1/0).reverse());for(let r of i)e.unshift(xt(r))}else t!==void 0&&e.push(xt(t));return e}static _$Eu(t,e){let i=e.attribute;return i===!1?void 0:typeof i=="string"?i:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){let t=new Map,e=this.constructor.elementProperties;for(let i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){let t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Zt(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){let i=this.constructor.elementProperties.get(t),r=this.constructor._$Eu(t,i);if(r!==void 0&&i.reflect===!0){let o=(i.converter?.toAttribute!==void 0?i.converter:j).toAttribute(e,i.type);this._$Em=t,o==null?this.removeAttribute(r):this.setAttribute(r,o),this._$Em=null}}_$AK(t,e){let i=this.constructor,r=i._$Eh.get(t);if(r!==void 0&&this._$Em!==r){let o=i.getPropertyOptions(r),n=typeof o.converter=="function"?{fromAttribute:o.converter}:o.converter?.fromAttribute!==void 0?o.converter:j;this._$Em=r;let l=n.fromAttribute(e,o.type);this[r]=l??this._$Ej?.get(r)??l,this._$Em=null}}requestUpdate(t,e,i,r=!1,o){if(t!==void 0){let n=this.constructor;if(r===!1&&(o=this[t]),i??=n.getPropertyOptions(t),!((i.hasChanged??Q)(o,e)||i.useDefault&&i.reflect&&o===this._$Ej?.get(t)&&!this.hasAttribute(n._$Eu(t,i))))return;this.C(t,e,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:r,wrapped:o},n){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,n??e??this[t]),o!==!0||n!==void 0)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),r===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}let t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[r,o]of this._$Ep)this[r]=o;this._$Ep=void 0}let i=this.constructor.elementProperties;if(i.size>0)for(let[r,o]of i){let{wrapped:n}=o,l=this[r];n!==!0||this._$AL.has(r)||l===void 0||this.C(r,void 0,o,l)}}let t=!1,e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(i=>i.hostUpdate?.()),this.update(e)):this._$EM()}catch(i){throw t=!1,this._$EM(),i}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(t){}firstUpdated(t){}};E.elementStyles=[],E.shadowRootOptions={mode:"open"},E[V("elementProperties")]=new Map,E[V("finalized")]=new Map,Be?.({ReactiveElement:E}),(J.reactiveElementVersions??=[]).push("2.1.2");var Et=globalThis,Ft=s=>s,tt=Et.trustedTypes,Wt=tt?tt.createPolicy("lit-html",{createHTML:s=>s}):void 0,Tt="$lit$",T=`lit$${Math.random().toFixed(9).slice(2)}$`,St="?"+T,Ve=`<${St}>`,O=document,G=()=>O.createComment(""),q=s=>s===null||typeof s!="object"&&typeof s!="function",Pt=Array.isArray,te=s=>Pt(s)||typeof s?.[Symbol.iterator]=="function",Ct=`[ 	
\f\r]`,Z=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Kt=/-->/g,Yt=/>/g,M=RegExp(`>|${Ct}(?:([^\\s"'>=/]+)(${Ct}*=${Ct}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Xt=/'/g,Jt=/"/g,ee=/^(?:script|style|textarea|title)$/i,It=s=>(t,...e)=>({_$litType$:s,strings:t,values:e}),_=It(1),$s=It(2),vs=It(3),f=Symbol.for("lit-noChange"),d=Symbol.for("lit-nothing"),Qt=new WeakMap,U=O.createTreeWalker(O,129);function se(s,t){if(!Pt(s)||!s.hasOwnProperty("raw"))throw Error("invalid template strings array");return Wt!==void 0?Wt.createHTML(t):t}var ie=(s,t)=>{let e=s.length-1,i=[],r,o=t===2?"<svg>":t===3?"<math>":"",n=Z;for(let l=0;l<e;l++){let a=s[l],h,u,c=-1,m=0;for(;m<a.length&&(n.lastIndex=m,u=n.exec(a),u!==null);)m=n.lastIndex,n===Z?u[1]==="!--"?n=Kt:u[1]!==void 0?n=Yt:u[2]!==void 0?(ee.test(u[2])&&(r=RegExp("</"+u[2],"g")),n=M):u[3]!==void 0&&(n=M):n===M?u[0]===">"?(n=r??Z,c=-1):u[1]===void 0?c=-2:(c=n.lastIndex-u[2].length,h=u[1],n=u[3]===void 0?M:u[3]==='"'?Jt:Xt):n===Jt||n===Xt?n=M:n===Kt||n===Yt?n=Z:(n=M,r=void 0);let p=n===M&&s[l+1].startsWith("/>")?" ":"";o+=n===Z?a+Ve:c>=0?(i.push(h),a.slice(0,c)+Tt+a.slice(c)+T+p):a+T+(c===-2?l:p)}return[se(s,o+(s[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),i]},F=class s{constructor({strings:t,_$litType$:e},i){let r;this.parts=[];let o=0,n=0,l=t.length-1,a=this.parts,[h,u]=ie(t,e);if(this.el=s.createElement(h,i),U.currentNode=this.el.content,e===2||e===3){let c=this.el.content.firstChild;c.replaceWith(...c.childNodes)}for(;(r=U.nextNode())!==null&&a.length<l;){if(r.nodeType===1){if(r.hasAttributes())for(let c of r.getAttributeNames())if(c.endsWith(Tt)){let m=u[n++],p=r.getAttribute(c).split(T),v=/([.?@])?(.*)/.exec(m);a.push({type:1,index:o,name:v[2],strings:p,ctor:v[1]==="."?st:v[1]==="?"?it:v[1]==="@"?rt:k}),r.removeAttribute(c)}else c.startsWith(T)&&(a.push({type:6,index:o}),r.removeAttribute(c));if(ee.test(r.tagName)){let c=r.textContent.split(T),m=c.length-1;if(m>0){r.textContent=tt?tt.emptyScript:"";for(let p=0;p<m;p++)r.append(c[p],G()),U.nextNode(),a.push({type:2,index:++o});r.append(c[m],G())}}}else if(r.nodeType===8)if(r.data===St)a.push({type:2,index:o});else{let c=-1;for(;(c=r.data.indexOf(T,c+1))!==-1;)a.push({type:7,index:o}),c+=T.length-1}o++}}static createElement(t,e){let i=O.createElement("template");return i.innerHTML=t,i}};function R(s,t,e=s,i){if(t===f)return t;let r=i!==void 0?e._$Co?.[i]:e._$Cl,o=q(t)?void 0:t._$litDirective$;return r?.constructor!==o&&(r?._$AO?.(!1),o===void 0?r=void 0:(r=new o(s),r._$AT(s,e,i)),i!==void 0?(e._$Co??=[])[i]=r:e._$Cl=r),r!==void 0&&(t=R(s,r._$AS(s,t.values),r,i)),t}var et=class{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){let{el:{content:e},parts:i}=this._$AD,r=(t?.creationScope??O).importNode(e,!0);U.currentNode=r;let o=U.nextNode(),n=0,l=0,a=i[0];for(;a!==void 0;){if(n===a.index){let h;a.type===2?h=new N(o,o.nextSibling,this,t):a.type===1?h=new a.ctor(o,a.name,a.strings,this,t):a.type===6&&(h=new ot(o,this,t)),this._$AV.push(h),a=i[++l]}n!==a?.index&&(o=U.nextNode(),n++)}return U.currentNode=O,r}p(t){let e=0;for(let i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}},N=class s{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,r){this.type=2,this._$AH=d,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode,e=this._$AM;return e!==void 0&&t?.nodeType===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=R(this,t,e),q(t)?t===d||t==null||t===""?(this._$AH!==d&&this._$AR(),this._$AH=d):t!==this._$AH&&t!==f&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):te(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==d&&q(this._$AH)?this._$AA.nextSibling.data=t:this.T(O.createTextNode(t)),this._$AH=t}$(t){let{values:e,_$litType$:i}=t,r=typeof i=="number"?this._$AC(t):(i.el===void 0&&(i.el=F.createElement(se(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===r)this._$AH.p(e);else{let o=new et(r,this),n=o.u(this.options);o.p(e),this.T(n),this._$AH=o}}_$AC(t){let e=Qt.get(t.strings);return e===void 0&&Qt.set(t.strings,e=new F(t)),e}k(t){Pt(this._$AH)||(this._$AH=[],this._$AR());let e=this._$AH,i,r=0;for(let o of t)r===e.length?e.push(i=new s(this.O(G()),this.O(G()),this,this.options)):i=e[r],i._$AI(o),r++;r<e.length&&(this._$AR(i&&i._$AB.nextSibling,r),e.length=r)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){let i=Ft(t).nextSibling;Ft(t).remove(),t=i}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}},k=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,r,o){this.type=1,this._$AH=d,this._$AN=void 0,this.element=t,this.name=e,this._$AM=r,this.options=o,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=d}_$AI(t,e=this,i,r){let o=this.strings,n=!1;if(o===void 0)t=R(this,t,e,0),n=!q(t)||t!==this._$AH&&t!==f,n&&(this._$AH=t);else{let l=t,a,h;for(t=o[0],a=0;a<o.length-1;a++)h=R(this,l[i+a],e,a),h===f&&(h=this._$AH[a]),n||=!q(h)||h!==this._$AH[a],h===d?t=d:t!==d&&(t+=(h??"")+o[a+1]),this._$AH[a]=h}n&&!r&&this.j(t)}j(t){t===d?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},st=class extends k{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===d?void 0:t}},it=class extends k{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==d)}},rt=class extends k{constructor(t,e,i,r,o){super(t,e,i,r,o),this.type=5}_$AI(t,e=this){if((t=R(this,t,e,0)??d)===f)return;let i=this._$AH,r=t===d&&i!==d||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,o=t!==d&&(i===d||r);r&&this.element.removeEventListener(this.name,this,i),o&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}},ot=class{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){R(this,t)}},re={M:Tt,P:T,A:St,C:1,L:ie,R:et,D:te,V:R,I:N,H:k,N:it,U:rt,B:st,F:ot},je=Et.litHtmlPolyfillSupport;je?.(F,N),(Et.litHtmlVersions??=[]).push("3.3.2");var oe=(s,t,e)=>{let i=e?.renderBefore??t,r=i._$litPart$;if(r===void 0){let o=e?.renderBefore??null;i._$litPart$=r=new N(t.insertBefore(G(),o),o,void 0,e??{})}return r._$AI(s),r};var Mt=globalThis,S=class extends E{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){let e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=oe(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return f}};S._$litElement$=!0,S.finalized=!0,Mt.litElementHydrateSupport?.({LitElement:S});var Ze=Mt.litElementPolyfillSupport;Ze?.({LitElement:S});(Mt.litElementVersions??=[]).push("4.2.2");var ne="1.12.1",ae="0.1.0";function Ge(s){class t extends s{get isLTR(){return getComputedStyle(this).direction!=="rtl"}hasVisibleFocusInTree(){let i=((r=document)=>{var o;let n=r.activeElement;for(;n!=null&&n.shadowRoot&&n.shadowRoot.activeElement;)n=n.shadowRoot.activeElement;let l=n?[n]:[];for(;n;){let a=n.assignedSlot||n.parentElement||((o=n.getRootNode())==null?void 0:o.host);a&&l.push(a),n=a}return l})(this.getRootNode())[0];return i?i.matches(":focus-visible")||i.matches(".focus-visible"):!1}}return t}var H=class extends Ge(S){get dir(){var t;return(t=getComputedStyle(this).direction)!=null?t:"ltr"}};H.VERSION=ne,H.CORE_VERSION=ae;var qe={attribute:!0,type:String,converter:j,reflect:!1,hasChanged:Q},Fe=(s=qe,t,e)=>{let{kind:i,metadata:r}=e,o=globalThis.litPropertyMetadata.get(r);if(o===void 0&&globalThis.litPropertyMetadata.set(r,o=new Map),i==="setter"&&((s=Object.create(s)).wrapped=!0),o.set(e.name,s),i==="accessor"){let{name:n}=e;return{set(l){let a=t.get.call(this);t.set.call(this,l),this.requestUpdate(n,a,s,!0,l)},init(l){return l!==void 0&&this.C(n,void 0,s,l),l}}}if(i==="setter"){let{name:n}=e;return function(l){let a=this[n];t.call(this,l),this.requestUpdate(n,a,s,!0,l)}}throw Error("Unsupported decorator location: "+i)};function P(s){return(t,e)=>typeof e=="object"?Fe(s,t,e):((i,r,o)=>{let n=r.hasOwnProperty(o);return r.constructor.createProperty(o,i),n?Object.getOwnPropertyDescriptor(r,o):void 0})(s,t,e)}function le(s){return P({...s,state:!0,attribute:!1})}var Ut=(s,t,e)=>(e.configurable=!0,e.enumerable=!0,Reflect.decorate&&typeof t!="object"&&Object.defineProperty(s,t,e),e);function ce(s,t){return(e,i,r)=>{let o=n=>n.renderRoot?.querySelector(s)??null;if(t){let{get:n,set:l}=typeof i=="object"?e:r??(()=>{let a=Symbol();return{get(){return this[a]},set(h){this[a]=h}}})();return Ut(e,i,{get(){let a=n.call(this);return a===void 0&&(a=o(this),(a!==null||this.hasUpdated)&&l.call(this,a)),a}})}return Ut(e,i,{get(){return o(this)}})}}var Ot=s=>s??d;var y={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4,EVENT:5,ELEMENT:6},w=s=>(...t)=>({_$litDirective$:s,values:t}),b=class{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,e,i){this._$Ct=t,this._$AM=e,this._$Ci=i}_$AS(t,e){return this.update(t,e)}update(t,e){return this.render(...e)}};var{I:We}=re,he=s=>s,de=s=>s===null||typeof s!="object"&&typeof s!="function";var nt=s=>s.strings===void 0,pe=()=>document.createComment(""),z=(s,t,e)=>{let i=s._$AA.parentNode,r=t===void 0?s._$AB:t._$AA;if(e===void 0){let o=i.insertBefore(pe(),r),n=i.insertBefore(pe(),r);e=new We(o,n,s,s.options)}else{let o=e._$AB.nextSibling,n=e._$AM,l=n!==s;if(l){let a;e._$AQ?.(s),e._$AM=s,e._$AP!==void 0&&(a=s._$AU)!==n._$AU&&e._$AP(a)}if(o!==r||l){let a=e._$AA;for(;a!==o;){let h=he(a).nextSibling;he(i).insertBefore(a,r),a=h}}}return e},I=(s,t,e=s)=>(s._$AI(t,e),s),Ke={},at=(s,t=Ke)=>s._$AH=t,ue=s=>s._$AH,lt=s=>{s._$AR(),s._$AA.remove()};var me=(s,t,e)=>{let i=new Map;for(let r=t;r<=e;r++)i.set(s[r],r);return i},Ye=w(class extends b{constructor(s){if(super(s),s.type!==y.CHILD)throw Error("repeat() can only be used in text expressions")}dt(s,t,e){let i;e===void 0?e=t:t!==void 0&&(i=t);let r=[],o=[],n=0;for(let l of s)r[n]=i?i(l,n):n,o[n]=e(l,n),n++;return{values:o,keys:r}}render(s,t,e){return this.dt(s,t,e).values}update(s,[t,e,i]){let r=ue(s),{values:o,keys:n}=this.dt(t,e,i);if(!Array.isArray(r))return this.ut=n,o;let l=this.ut??=[],a=[],h,u,c=0,m=r.length-1,p=0,v=o.length-1;for(;c<=m&&p<=v;)if(r[c]===null)c++;else if(r[m]===null)m--;else if(l[c]===n[p])a[p]=I(r[c],o[p]),c++,p++;else if(l[m]===n[v])a[v]=I(r[m],o[v]),m--,v--;else if(l[c]===n[v])a[v]=I(r[c],o[v]),z(s,a[v+1],r[c]),c++,v--;else if(l[m]===n[p])a[p]=I(r[m],o[p]),z(s,r[c],r[m]),m--,p++;else if(h===void 0&&(h=me(n,p,v),u=me(l,c,m)),h.has(l[c]))if(h.has(l[m])){let C=u.get(n[p]),wt=C!==void 0?r[C]:null;if(wt===null){let Bt=z(s,r[c]);I(Bt,o[p]),a[p]=Bt}else a[p]=I(wt,o[p]),z(s,r[c],wt),r[C]=null;p++}else lt(r[m]),m--;else lt(r[c]),c++;for(;p<=v;){let C=z(s,a[v+1]);I(C,o[p]),a[p++]=C}for(;c<=m;){let C=r[c++];C!==null&&lt(C)}return this.ut=n,at(s,a),f}});var Xe=w(class extends b{constructor(s){if(super(s),s.type!==y.ATTRIBUTE||s.name!=="class"||s.strings?.length>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(s){return" "+Object.keys(s).filter(t=>s[t]).join(" ")+" "}update(s,[t]){if(this.st===void 0){this.st=new Set,s.strings!==void 0&&(this.nt=new Set(s.strings.join(" ").split(/\s/).filter(i=>i!=="")));for(let i in t)t[i]&&!this.nt?.has(i)&&this.st.add(i);return this.render(t)}let e=s.element.classList;for(let i of this.st)i in t||(e.remove(i),this.st.delete(i));for(let i in t){let r=!!t[i];r===this.st.has(i)||this.nt?.has(i)||(r?(e.add(i),this.st.add(i)):(e.remove(i),this.st.delete(i)))}return f}});var fe="important",Je=" !"+fe,Qe=w(class extends b{constructor(s){if(super(s),s.type!==y.ATTRIBUTE||s.name!=="style"||s.strings?.length>2)throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.")}render(s){return Object.keys(s).reduce((t,e)=>{let i=s[e];return i==null?t:t+`${e=e.includes("-")?e:e.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g,"-$&").toLowerCase()}:${i};`},"")}update(s,[t]){let{style:e}=s.element;if(this.ft===void 0)return this.ft=new Set(Object.keys(t)),this.render(t);for(let i of this.ft)t[i]==null&&(this.ft.delete(i),i.includes("-")?e.removeProperty(i):e[i]=null);for(let i in t){let r=t[i];if(r!=null){this.ft.add(i);let o=typeof r=="string"&&r.endsWith(Je);i.includes("-")||o?e.setProperty(i,o?r.slice(0,-11):r,o?fe:""):e[i]=r}}return f}});var W=(s,t)=>{let e=s._$AN;if(e===void 0)return!1;for(let i of e)i._$AO?.(t,!1),W(i,t);return!0},ct=s=>{let t,e;do{if((t=s._$AM)===void 0)break;e=t._$AN,e.delete(s),s=t}while(e?.size===0)},ge=s=>{for(let t;t=s._$AM;s=t){let e=t._$AN;if(e===void 0)t._$AN=e=new Set;else if(e.has(s))break;e.add(s),ss(t)}};function ts(s){this._$AN!==void 0?(ct(this),this._$AM=s,ge(this)):this._$AM=s}function es(s,t=!1,e=0){let i=this._$AH,r=this._$AN;if(r!==void 0&&r.size!==0)if(t)if(Array.isArray(i))for(let o=e;o<i.length;o++)W(i[o],!1),ct(i[o]);else i!=null&&(W(i,!1),ct(i));else W(this,s)}var ss=s=>{s.type==y.CHILD&&(s._$AP??=es,s._$AQ??=ts)},D=class extends b{constructor(){super(...arguments),this._$AN=void 0}_$AT(t,e,i){super._$AT(t,e,i),ge(this),this.isConnected=t._$AU}_$AO(t,e=!0){t!==this.isConnected&&(this.isConnected=t,t?this.reconnected?.():this.disconnected?.()),e&&(W(this,t),ct(this))}setValue(t){if(nt(this._$Ct))this._$Ct._$AI(t,this);else{let e=[...this._$Ct._$AH];e[this._$Ci]=t,this._$Ct._$AI(e,this,0)}}disconnected(){}reconnected(){}};var ht=class{constructor(t){this.G=t}disconnect(){this.G=void 0}reconnect(t){this.G=t}deref(){return this.G}},pt=class{constructor(){this.Y=void 0,this.Z=void 0}get(){return this.Y}pause(){this.Y??=new Promise(t=>this.Z=t)}resume(){this.Z?.(),this.Y=this.Z=void 0}};var $e=s=>!de(s)&&typeof s.then=="function",ve=1073741823,Rt=class extends D{constructor(){super(...arguments),this._$Cwt=ve,this._$Cbt=[],this._$CK=new ht(this),this._$CX=new pt}render(...t){return t.find(e=>!$e(e))??f}update(t,e){let i=this._$Cbt,r=i.length;this._$Cbt=e;let o=this._$CK,n=this._$CX;this.isConnected||this.disconnected();for(let l=0;l<e.length&&!(l>this._$Cwt);l++){let a=e[l];if(!$e(a))return this._$Cwt=l,a;l<r&&a===i[l]||(this._$Cwt=ve,r=0,Promise.resolve(a).then(async h=>{for(;n.get();)await n.get();let u=o.deref();if(u!==void 0){let c=u._$Cbt.indexOf(a);c>-1&&c<u._$Cwt&&(u._$Cwt=c,u.setValue(h))}}))}return f}disconnected(){this._$CK.disconnect(),this._$CX.pause()}reconnected(){this._$CK.reconnect(this),this._$CX.resume()}},is=w(Rt);var rs=w(class extends b{constructor(s){if(super(s),s.type!==y.PROPERTY&&s.type!==y.ATTRIBUTE&&s.type!==y.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!nt(s))throw Error("`live` bindings can only contain a single expression")}render(s){return s}update(s,[t]){if(t===f||t===d)return t;let e=s.element,i=s.name;if(s.type===y.PROPERTY){if(t===e[i])return f}else if(s.type===y.BOOLEAN_ATTRIBUTE){if(!!t===e.hasAttribute(i))return f}else if(s.type===y.ATTRIBUTE&&e.getAttribute(i)===t+"")return f;return at(s),t}});var K=class extends b{constructor(t){if(super(t),this.it=d,t.type!==y.CHILD)throw Error(this.constructor.directiveName+"() can only be used in child bindings")}render(t){if(t===d||t==null)return this._t=void 0,this.it=t;if(t===f)return t;if(typeof t!="string")throw Error(this.constructor.directiveName+"() called with a non-string value");if(t===this.it)return this._t;this.it=t;let e=[t];return e.raw=e,this._t={_$litType$:this.constructor.resultType,strings:e,values:[]}}};K.directiveName="unsafeHTML",K.resultType=1;var os=w(K);var kt=new WeakMap,ns=w(class extends D{render(s){return d}update(s,[t]){let e=t!==this.G;return e&&this.G!==void 0&&this.rt(void 0),(e||this.lt!==this.ct)&&(this.G=t,this.ht=s.options?.host,this.rt(this.ct=s.element)),d}rt(s){if(this.isConnected||(s=void 0),typeof this.G=="function"){let t=this.ht??globalThis,e=kt.get(t);e===void 0&&(e=new WeakMap,kt.set(t,e)),e.get(this.G)!==void 0&&this.G.call(this.ht,void 0),e.set(this.G,s),s!==void 0&&this.G.call(this.ht,s)}else this.G.value=s}get lt(){return typeof this.G=="function"?kt.get(this.ht??globalThis)?.get(this.G):this.G?.value}disconnected(){this.lt===this.ct&&this.rt(void 0)}reconnected(){this.rt(this.ct)}});var dt=class s{constructor(){this.iconsetMap=new Map}static getInstance(){return s.instance||(s.instance=new s),s.instance}addIconset(t,e){this.iconsetMap.set(t,e);let i=new CustomEvent("sp-iconset-added",{bubbles:!0,composed:!0,detail:{name:t,iconset:e}});setTimeout(()=>window.dispatchEvent(i),0)}removeIconset(t){this.iconsetMap.delete(t);let e=new CustomEvent("sp-iconset-removed",{bubbles:!0,composed:!0,detail:{name:t}});setTimeout(()=>window.dispatchEvent(e),0)}getIconset(t){return this.iconsetMap.get(t)}};var Lt=Symbol("system resolver updated"),ut=class{constructor(t){this.system="spectrum",this.host=t,this.host.addController(this)}hostConnected(){this.resolveSystem()}hostDisconnected(){var t;(t=this.unsubscribe)==null||t.call(this)}resolveSystem(){let t=new CustomEvent("sp-system-context",{bubbles:!0,composed:!0,detail:{callback:(e,i)=>{let r=this.system;this.system=e,this.unsubscribe=i,this.host.requestUpdate(Lt,r)}},cancelable:!0});this.host.dispatchEvent(t)}};var as=bt`
    :host{--spectrum-icon-inline-size:var(--mod-icon-inline-size,var(--mod-icon-size,var(--spectrum-icon-size)));--spectrum-icon-block-size:var(--mod-icon-block-size,var(--mod-icon-size,var(--spectrum-icon-size)));inline-size:var(--spectrum-icon-inline-size);block-size:var(--spectrum-icon-block-size);color:var(--mod-icon-color,inherit);pointer-events:none;fill:currentColor;display:inline-block}@media (forced-colors:active){:host{forced-color-adjust:auto}}:host{--spectrum-icon-size:var(--spectrum-workflow-icon-size-100)}:host([size=xxs]){--spectrum-icon-size:var(--spectrum-workflow-icon-size-xxs)}:host([size=xs]){--spectrum-icon-size:var(--spectrum-workflow-icon-size-50)}:host([size=s]){--spectrum-icon-size:var(--spectrum-workflow-icon-size-75)}:host([size=l]){--spectrum-icon-size:var(--spectrum-workflow-icon-size-200)}:host([size=xl]){--spectrum-icon-size:var(--spectrum-workflow-icon-size-300)}:host([size=xxl]){--spectrum-icon-size:var(--spectrum-workflow-icon-size-xxl)}#container{height:100%}img,svg,::slotted(*){vertical-align:top;width:100%;height:100%;color:inherit}@media (forced-colors:active){img,svg,::slotted(*){forced-color-adjust:auto}}:host(:not(:root)){overflow:hidden}:host(:dir(rtl)){--spectrum-logical-rotation:matrix(-1,0,0,1,0,0)}
`,_e=as;var ls=Object.defineProperty,cs=Object.getOwnPropertyDescriptor,Nt=(s,t,e,i)=>{for(var r=i>1?void 0:i?cs(t,e):t,o=s.length-1,n;o>=0;o--)(n=s[o])&&(r=(i?n(t,e,r):n(r))||r);return i&&r&&ls(t,e,r),r},$=class extends H{constructor(){super(...arguments),this.unsubscribeSystemContext=null,this.spectrumVersion=1,this.label="",this.systemResolver=new ut(this)}static get styles(){return[_e]}connectedCallback(){super.connectedCallback()}disconnectedCallback(){super.disconnectedCallback(),this.unsubscribeSystemContext&&(this.unsubscribeSystemContext(),this.unsubscribeSystemContext=null)}update(t){t.has("label")&&(this.label?this.removeAttribute("aria-hidden"):this.setAttribute("aria-hidden","true")),t.has(Lt)&&(this.spectrumVersion=this.systemResolver.system==="spectrum-two"?2:1),super.update(t)}render(){return _`
      <slot></slot>
    `}};Nt([le()],$.prototype,"spectrumVersion",2),Nt([P({reflect:!0})],$.prototype,"label",2),Nt([P({reflect:!0})],$.prototype,"size",2);var hs=Object.defineProperty,ps=Object.getOwnPropertyDescriptor,Ht=(s,t,e,i)=>{for(var r=i>1?void 0:i?ps(t,e):t,o=s.length-1,n;o>=0;o--)(n=s[o])&&(r=(i?n(t,e,r):n(r))||r);return i&&r&&hs(t,e,r),r},L=class extends ${constructor(){super(...arguments),this.iconsetListener=t=>{if(!this.name)return;let e=this.parseIcon(this.name);t.detail.name===e.iconset&&(this.updateIconPromise=this.updateIcon())}}connectedCallback(){super.connectedCallback(),window.addEventListener("sp-iconset-added",this.iconsetListener)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("sp-iconset-added",this.iconsetListener)}firstUpdated(){this.updateIconPromise=this.updateIcon()}updated(t){super.updated(t)}attributeChangedCallback(t,e,i){super.attributeChangedCallback(t,e,i),this.updateIconPromise=this.updateIcon()}announceIconImageSrcError(){this.dispatchEvent(new Event("error",{cancelable:!1,bubbles:!1,composed:!1}))}render(){return this.name?_`
        <div id="container"></div>
      `:this.src?_`
        <img
          src=${this.src}
          alt=${Ot(this.label)}
          @error=${this.announceIconImageSrcError}
        />
      `:super.render()}async updateIcon(){if(this.updateIconPromise&&await this.updateIconPromise,!this.name)return Promise.resolve();let t=this.parseIcon(this.name),e=dt.getInstance().getIconset(t.iconset);return!e||!this.iconContainer?Promise.resolve():(this.iconContainer.innerHTML="",e.applyIconToElement(this.iconContainer,t.icon,this.size||"",this.label?this.label:""))}parseIcon(t){let e=t.split(":"),i="default",r=t;return e.length>1&&(i=e[0],r=e[1]),{iconset:i,icon:r}}async getUpdateComplete(){let t=await super.getUpdateComplete();return await this.updateIconPromise,t}};Ht([P()],L.prototype,"src",2),Ht([P()],L.prototype,"name",2),Ht([ce("#container")],L.prototype,"iconContainer",2);A("sp-icon",L);var zt,g=function(s,...t){return zt?zt(s,...t):t.reduce((e,i,r)=>e+i+s[r+1],s[0])},x=s=>{zt=s};var ye=({width:s=24,height:t=24,hidden:e=!1,title:i="Document"}={})=>g`<svg
    xmlns="http://www.w3.org/2000/svg"
    height="${t}"
    viewBox="0 0 36 36"
    width="${s}"
    aria-hidden=${e?"true":"false"}
    role="img"
    fill="currentColor"
    aria-label="${i}"
  >
    <path d="M20 11V2H7a1 1 0 0 0-1 1v30a1 1 0 0 0 1 1h22a1 1 0 0 0 1-1V12h-9a1 1 0 0 1-1-1Z" />
    <path d="M22 2h.086a1 1 0 0 1 .707.293l6.914 6.914a1 1 0 0 1 .293.707V10h-8Z" />
  </svg>`;var we=({width:s=24,height:t=24,hidden:e=!1,title:i="File"}={})=>g`<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${s}"
    height="${t}"
    viewBox="0 0 20 20"
    aria-hidden=${e?"true":"false"}
    role="img"
    fill="currentColor"
    aria-label="${i}"
  >
    <path
      d="m16.34131,5.28027l-3.62207-3.62109c-.4248-.4248-.98975-.65918-1.59033-.65918h-5.87891c-1.24072,0-2.25,1.00977-2.25,2.25v12.5c0,1.24023,1.00928,2.25,2.25,2.25h9.5c1.24072,0,2.25-1.00977,2.25-2.25V6.87109c0-.5918-.23975-1.17188-.65869-1.59082Zm-1.06104,1.06055c.04565.04565.07385.10376.10602.15918h-3.13629c-.41357,0-.75-.33691-.75-.75v-3.13599c.05518.03223.11316.06018.15869.10571l3.62158,3.62109Zm-.53027,10.15918H5.25c-.41357,0-.75-.33691-.75-.75V3.25c0-.41309.33643-.75.75-.75h4.75v3.25c0,1.24023,1.00928,2.25,2.25,2.25h3.25v7.75c0,.41309-.33643.75-.75.75Z"
      fill="currentColor"
    />
  </svg>`;var mt=class extends ${render(){return x(_),this.spectrumVersion===1?ye({hidden:!this.label,title:this.label}):we({hidden:!this.label,title:this.label})}};A("sp-icon-document",mt);var Ae=({width:s=24,height:t=24,hidden:e=!1,title:i="User Group"}={})=>g`<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${s}"
    height="${t}"
    viewBox="0 0 20 20"
    aria-hidden=${e?"true":"false"}
    role="img"
    fill="currentColor"
    aria-label="${i}"
  >
    <path
      d="m12.25293,11.94922c-2.27637,0-4.12793-1.94629-4.12793-4.33887s1.85156-4.33887,4.12793-4.33887,4.12793,1.94629,4.12793,4.33887-1.85156,4.33887-4.12793,4.33887Zm0-7.17773c-1.44922,0-2.62793,1.27344-2.62793,2.83887s1.17871,2.83887,2.62793,2.83887,2.62793-1.27344,2.62793-2.83887-1.17871-2.83887-2.62793-2.83887Zm-5.37598,12.84082c.21484-1.99219,2.57617-3.55273,5.37598-3.55273,2.82324,0,5.18457,1.55664,5.37598,3.54492.04004.41309.41602.72656.81836.67383.41211-.03906.71387-.40527.67383-.81836-.26367-2.74805-3.28125-4.90039-6.86816-4.90039-3.61426,0-6.56641,2.10352-6.86816,4.89258-.04395.41113.25391.78125.66602.82617.02734.00293.05371.00391.08105.00391.37793,0,.70312-.28516.74512-.66992Zm.24023-7.89355c.16895-.37793.00098-.82227-.37695-.99219-.98535-.44238-1.62109-1.47168-1.62109-2.62207,0-1.56543,1.17871-2.83887,2.62793-2.83887.15234,0,.30078.01465.44629.04102.40234.08105.7998-.19238.87402-.60059.0752-.40723-.19336-.79883-.60059-.87402-.2334-.04395-.47363-.06641-.71973-.06641-2.27637,0-4.12793,1.94629-4.12793,4.33887,0,1.74023.9834,3.30664,2.50586,3.99121.09961.04395.2041.06543.30762.06543.28613,0,.55957-.16504.68457-.44238Zm-4.74609,6.38867c.20508-1.90234,2.36914-3.42676,5.03223-3.5459.41406-.01855.73438-.36816.71582-.78223-.01758-.40234-.34961-.7168-.74805-.7168-.01172,0-.02344,0-.03418.00098-3.45312.1543-6.16797,2.20703-6.45801,4.88184-.04395.41211.25391.78223.66504.82715.02832.00293.05469.00391.08203.00391.37793,0,.70312-.28516.74512-.66895Z"
      fill="currentColor"
    />
  </svg>`;var be=({width:s=24,height:t=24,hidden:e=!1,title:i="User Group"}={})=>g`<svg
    xmlns="http://www.w3.org/2000/svg"
    height="${t}"
    viewBox="0 0 36 36"
    width="${s}"
    aria-hidden=${e?"true":"false"}
    role="img"
    fill="currentColor"
    aria-label="${i}"
  >
    <path
      d="M26.922 20.476c-1.441-.125-1.464-1.284-1.464-2.729a13.151 13.151 0 0 0 3.09-7.837c0-4.746-2.7-7.91-6.589-7.91a6.3 6.3 0 0 0-2.679.574c3.206 1.69 5.24 5.28 5.24 9.9a15.6 15.6 0 0 1-2.42 7.949.861.861 0 0 0 .474 1.288A13.488 13.488 0 0 1 31.779 30h3.257a.871.871 0 0 0 .879-.922c-.579-6.289-7.023-8.43-8.993-8.602Z"
    />
    <path
      d="M28.973 34a.931.931 0 0 0 .941-.988c-.62-6.734-7.525-9.028-9.636-9.212-1.544-.134-1.569-1.377-1.569-2.925a14.093 14.093 0 0 0 3.311-8.4C22.02 7.391 19.126 4 14.959 4S7.9 7.391 7.9 12.477a14.093 14.093 0 0 0 3.311 8.4c0 1.548-.025 2.791-1.569 2.925-2.113.182-9.018 2.476-9.642 9.21A.931.931 0 0 0 .945 34Z"
    />
  </svg>`;var ft=class extends ${render(){return x(_),this.spectrumVersion===2?Ae({hidden:!this.label,title:this.label}):be({hidden:!this.label,title:this.label})}};A("sp-icon-user-group",ft);var xe=({width:s=24,height:t=24,hidden:e=!1,title:i="Cloud"}={})=>g`<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${s}"
    height="${t}"
    viewBox="0 0 20 20"
    aria-hidden=${e?"true":"false"}
    role="img"
    fill="currentColor"
    aria-label="${i}"
  >
    <path
      d="m15.40674,17H3.71777c-1.90332,0-3.45166-1.54883-3.45166-3.45215,0-1.49316.9668-2.78027,2.32373-3.25-.04297-.23047-.06445-.46484-.06445-.70215,0-2.17969,1.80957-3.95312,4.03369-3.95312.27979,0,.55762.0293.83105.08789.63721-1.95801,2.47607-3.34668,4.58838-3.34668,2.6709,0,4.84424,2.17285,4.84424,4.84375,0,.43848-.0625.87305-.18701,1.29883,1.80225.53125,3.10303,2.19141,3.10303,4.1416,0,2.38867-1.94336,4.33203-4.33203,4.33203ZM6.55908,7.14258c-1.39697,0-2.53369,1.10059-2.53369,2.45312,0,.33203.06934.65625.20605.96484.09961.22363.08301.48242-.04395.69238-.12744.20996-.34912.34375-.59375.35938-1.0249.06543-1.82764.91602-1.82764,1.93555,0,1.07617.87549,1.95215,1.95166,1.95215h11.68896c1.56152,0,2.83203-1.27051,2.83203-2.83203,0-1.49707-1.17822-2.7334-2.68213-2.81445-.25439-.01367-.48438-.15625-.61084-.37695-.12646-.22168-.13184-.49219-.01416-.71777.25977-.49902.39111-1.01465.39111-1.53125,0-1.84375-1.5-3.34375-3.34424-3.34375-1.6626,0-3.08008,1.25195-3.29736,2.91211-.03076.23535-.17188.44238-.37988.55762-.20752.11719-.45898.12598-.67432.02734-.34766-.1582-.70654-.23828-1.06787-.23828Z"
      fill="currentColor"
    />
  </svg>`;var Ce=({width:s=24,height:t=24,hidden:e=!1,title:i="Cloud Outline"}={})=>g`<svg
    xmlns="http://www.w3.org/2000/svg"
    height="${t}"
    viewBox="0 0 36 36"
    width="${s}"
    aria-hidden=${e?"true":"false"}
    role="img"
    fill="currentColor"
    aria-label="${i}"
  >
    <path
      d="M20.5 6.714a6.788 6.788 0 0 1 6.538 8.606 5.492 5.492 0 0 1 .605-.034 5.357 5.357 0 0 1 0 10.714H6.214a3.215 3.215 0 0 1 0-6.429h.359v-1.428a5.718 5.718 0 0 1 7.2-5.519 6.788 6.788 0 0 1 6.727-5.91Zm0-2a8.811 8.811 0 0 0-8.233 5.715 7.724 7.724 0 0 0-7.69 7.406A5.214 5.214 0 0 0 6.214 28h21.429a7.357 7.357 0 0 0 1.643-14.529A8.8 8.8 0 0 0 20.5 4.714Z"
    />
  </svg>`;var gt=class extends ${render(){return x(_),this.spectrumVersion===2?xe({hidden:!this.label,title:this.label}):Ce({hidden:!this.label,title:this.label})}};A("sp-icon-cloud",gt);var Ee=({width:s=24,height:t=24,hidden:e=!1,title:i="Star"}={})=>g`<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${s}"
    height="${t}"
    viewBox="0 0 20 20"
    aria-hidden=${e?"true":"false"}
    role="img"
    fill="currentColor"
    aria-label="${i}"
  >
    <path
      d="M5.50586,18.63037c-.35938.00049-.71875-.1123-1.02734-.33691-.59375-.43164-.85352-1.16797-.66016-1.87646l.97754-3.57715c.0791-.28906-.02051-.5957-.25391-.78271l-2.89258-2.31934c-.57324-.45947-.79688-1.20801-.57031-1.90674.22754-.69824.84766-1.17188,1.58203-1.20654l3.70312-.17529c.29883-.01416.55957-.2041.66504-.4834l1.3125-3.46875c.25977-.6875.90234-1.13135,1.63672-1.13135s1.37695.44385,1.63672,1.13086v.00049l1.31055,3.46826c.10645.2793.36816.46973.66602.48389l3.7041.17529c.7334.03467,1.35449.5083,1.58203,1.20703.22656.69873.00293,1.44727-.57031,1.90625l-2.89355,2.31934c-.23242.18652-.33301.49414-.25391.78271l.97656,3.57422c.19336.70996-.06641,1.44775-.66211,1.87891-.59766.43359-1.37891.44727-1.99316.0415l-3.07129-2.03662c-.25098-.16553-.5752-.16602-.82617-.00146l-3.11719,2.04443c-.29492.19336-.62793.28955-.96094.28955ZM9.97852,2.86572c-.0791,0-.18359.02832-.23438.16211l-1.31152,3.46777c-.31641.83936-1.10059,1.40918-1.99805,1.45166l-3.70312.17529c-.14258.00684-.20117.09766-.22559.17236-.02441.0752-.03027.18311.08105.27295l2.89258,2.31885c.70117.56055,1.00098,1.48291.76367,2.34912l-.97754,3.57617c-.03809.13721.03027.22168.09473.26807.0625.04492.16211.08545.28418.00684l3.11719-2.04492c.75293-.49316,1.72559-.4917,2.47656.00537l3.07129,2.03662c.12109.0791.22168.04004.28516-.00635.06445-.04639.13281-.13037.09473-.26807l-.97656-3.57471c-.23633-.86572.06348-1.78711.76367-2.34814l2.89355-2.31934c.11133-.08887.10547-.19727.08105-.27197-.02441-.0752-.08301-.16602-.22559-.17285l-3.7041-.17529c-.89551-.04248-1.67969-.61182-1.99805-1.45117l-1.31055-3.46826c-.05078-.13379-.15527-.16211-.23438-.16211Z"
      fill="currentColor"
    />
  </svg>`;var Te=({width:s=24,height:t=24,hidden:e=!1,title:i="Star Outline"}={})=>g`<svg
    xmlns="http://www.w3.org/2000/svg"
    height="${t}"
    viewBox="0 0 36 36"
    width="${s}"
    aria-hidden=${e?"true":"false"}
    role="img"
    fill="currentColor"
    aria-label="${i}"
  >
    <path
      d="m18.059 5.082 3.554 9.5 10.219.481-7.974 6.4 2.671 9.837-8.535-5.568-8.557 5.615 2.7-9.873-7.974-6.4 10.2-.489Zm.023-4.259a.737.737 0 0 0-.7.479l-4.411 11.349-12.2.586a.75.75 0 0 0-.433 1.334l9.523 7.642-3.229 11.8a.752.752 0 0 0 .724.951.74.74 0 0 0 .41-.126L18 28.122l10.187 6.648a.742.742 0 0 0 .408.125.752.752 0 0 0 .725-.95l-3.189-11.732 9.528-7.653a.75.75 0 0 0-.434-1.334l-12.2-.575-4.24-11.34a.738.738 0 0 0-.703-.488Z"
    />
  </svg>`;var $t=class extends ${render(){return x(_),this.spectrumVersion===2?Ee({hidden:!this.label,title:this.label}):Te({hidden:!this.label,title:this.label})}};A("sp-icon-star",$t);var Se=({width:s=24,height:t=24,hidden:e=!1,title:i="Flag"}={})=>g`<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${s}"
    height="${t}"
    viewBox="0 0 20 20"
    aria-hidden=${e?"true":"false"}
    role="img"
    fill="currentColor"
    aria-label="${i}"
  >
    <path
      d="m17.68945,2.67773c-.19482-.14062-.44629-.18066-.67432-.10449l-.5874.19434c-1.0957.30566-2.25.28516-3.33643-.06641l-2.72754-.87988c-1.20947-.38965-2.50342-.45898-3.74072-.19531l-2.12305.44922v-.3252c0-.41406-.33594-.75-.75-.75s-.75.33594-.75.75v16.5c0,.41406.33594.75.75.75s.75-.33594.75-.75v-4.61719l2.43311-.51562c.9834-.20605,2.01025-.1543,2.96973.15625l2.72803.88086c.72559.2334,1.47461.35156,2.22852.35156.66895,0,1.34229-.09277,2.00586-.28027l.61963-.2041c.30713-.10059.51514-.3877.51514-.71191V3.28516c0-.24023-.11523-.4668-.31055-.60742Zm-1.18945,10.08984l-.07275.02441c-1.09375.30859-2.24805.28516-3.33594-.06543l-2.72754-.88086c-1.20801-.38965-2.50098-.45605-3.74072-.19531l-2.12305.44971V3.60767l2.43359-.51489c.98193-.20801,2.00977-.15332,2.96924.15625l2.72754.87988c1.24951.4043,2.57178.46191,3.86963.16602v8.47266Z"
      fill="currentColor"
    />
  </svg>`;var Pe=({width:s=24,height:t=24,hidden:e=!1,title:i="Flag"}={})=>g`<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${s}"
    height="${t}"
    viewBox="0 0 36 36"
    aria-hidden=${e?"true":"false"}
    role="img"
    fill="currentColor"
    aria-label="${i}"
  >
    <g>
      <path
        d="M33.249 6.42a19.446 19.446 0 0 0-4.666-.566 19.033 19.033 0 0 0-4.113.453 1.093 1.093 0 0 1-1.3-1.084V3.609a1.087 1.087 0 0 0-.815-1.061A19.494 19.494 0 0 0 17.75 2 19.153 19.153 0 0 0 8 4.648v15.165a19.1 19.1 0 0 1 9.76-2.646 1.1 1.1 0 0 1 1.073 1.1v3.739a.991.991 0 0 0 1.406.908 19.28 19.28 0 0 1 12.515-1.435A1.007 1.007 0 0 0 34 20.511V7.4a1 1 0 0 0-.751-.98Z"
      />
      <rect x="2" y="2" width="4" height="34" rx=".5" />
    </g>
  </svg>`;var vt=class extends ${render(){return x(_),this.spectrumVersion===2?Se({hidden:!this.label,title:this.label}):Pe({hidden:!this.label,title:this.label})}};A("sp-icon-flag",vt);var Dt,_t=function(s,...t){return Dt?Dt(s,...t):t.reduce((e,i,r)=>e+i+s[r+1],s[0])},Ie=s=>{Dt=s};var Me=({width:s=24,height:t=24,hidden:e=!1,title:i="Checkmark100"}={})=>_t`<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 10 10"
    aria-hidden=${e?"true":"false"}
    role="img"
    fill="currentColor"
    aria-label="${i}"
    width="${s}"
    height="${t}"
  >
    <path
      d="M3.5 9.5a1 1 0 0 1-.774-.368l-2.45-3a1 1 0 1 1 1.548-1.264l1.657 2.028 4.68-6.01A1 1 0 0 1 9.74 2.114l-5.45 7a1 1 0 0 1-.777.386z"
    />
  </svg>`;var Ue=({width:s=24,height:t=24,hidden:e=!1,title:i="Checkmark100"}={})=>_t`<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 10 10"
    aria-hidden=${e?"true":"false"}
    role="img"
    fill="currentColor"
    aria-label="${i}"
    width="${s}"
    height="${t}"
  >
    <path
      d="M3.5 9.5a1 1 0 0 1-.774-.368l-2.45-3a1 1 0 1 1 1.548-1.264l1.657 2.028 4.68-6.01A1 1 0 0 1 9.74 2.114l-5.45 7a1 1 0 0 1-.777.386z"
    />
  </svg>`;var yt=class extends ${render(){return Ie(_),this.spectrumVersion===2?Me({hidden:!this.label,title:this.label}):Ue({hidden:!this.label,title:this.label})}};A("sp-icon-checkmark100",yt);var Oe=!1;function rn(){Oe=!0}function on(){return Oe}export{rn as ensureFormNavIcons,on as formNavIconsReady};
/*! Bundled license information:

@lit/reactive-element/css-tag.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/reactive-element.js:
lit-html/lit-html.js:
lit-element/lit-element.js:
@lit/reactive-element/decorators/property.js:
@lit/reactive-element/decorators/state.js:
@lit/reactive-element/decorators/base.js:
@lit/reactive-element/decorators/query.js:
lit-html/directive.js:
lit-html/directives/repeat.js:
lit-html/async-directive.js:
lit-html/directives/until.js:
lit-html/directives/unsafe-html.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/is-server.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/directives/if-defined.js:
lit-html/directives/class-map.js:
lit-html/directives/style-map.js:
  (**
   * @license
   * Copyright 2018 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/directive-helpers.js:
lit-html/directives/live.js:
lit-html/directives/ref.js:
  (**
   * @license
   * Copyright 2020 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/directives/private-async-helpers.js:
lit-html/directives/when.js:
lit-html/directives/join.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/
