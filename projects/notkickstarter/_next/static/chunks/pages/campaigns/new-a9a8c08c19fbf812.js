(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[86],{34166:function(e,t,n){(window.__NEXT_P=window.__NEXT_P||[]).push(["/campaigns/new",function(){return n(85127)}])},85127:function(e,t,n){"use strict";n.r(t);var r=n(4111),i=n(47568),a=n(51438),s=n(52951),o=n(14924),u=n(88029),c=n(60460),h=n(34051),l=n.n(h),m=n(85893),p=n(67294),d=n(75424),g=n(60416),f=n(80967),Z=n(68156),v=n(83544),b=n(12889),C=n(1508),x=n(96215),_=function(e){(0,u.Z)(n,e);var t=(0,c.Z)(n);function n(){var e;(0,a.Z)(this,n),e=t.apply(this,arguments),(0,o.Z)((0,r.Z)(e),"state",{minimumContribution:"",errorMessage:"",loading:!1});var s=(0,r.Z)(e);return(0,o.Z)((0,r.Z)(e),"onSubmit",function(){var e=(0,i.Z)(l().mark((function e(t){var n;return l().wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return t.preventDefault(),s.setState({loading:!0,errorMessage:""}),e.prev=2,e.next=5,C.Z.eth.getAccounts();case 5:return n=e.sent,e.next=8,b.Z.methods.createCampaign(s.state.minimumContribution).send({from:n[0]});case 8:x.Router.pushRoute("/"),e.next=14;break;case 11:e.prev=11,e.t0=e.catch(2),s.setState({errorMessage:e.t0.message});case 14:s.setState({loading:!1});case 15:case"end":return e.stop()}}),e,null,[[2,11]])})));return function(t){return e.apply(this,arguments)}}()),e}return(0,s.Z)(n,[{key:"render",value:function(){var e=this;return(0,m.jsxs)(v.Z,{children:[(0,m.jsx)("h3",{children:"Create Campaign"}),(0,m.jsxs)(d.Z,{onSubmit:this.onSubmit,error:!!this.state.errorMessage,children:[(0,m.jsxs)(d.Z.Field,{children:[(0,m.jsx)("label",{children:"Minimum Contribution"}),(0,m.jsx)(g.Z,{label:"Wei",labelPosition:"right",value:this.state.minimumContribution,onChange:function(t){return e.setState({minimumContribution:t.target.value})}})]}),(0,m.jsx)(f.Z,{primary:!0,loading:this.state.loading,children:"Create!"}),(0,m.jsx)(Z.Z,{error:!0,header:"Oops! Something went wrong",content:this.state.errorMessage})]})]})}}]),n}(p.Component);t.default=_}},function(e){e.O(0,[774,482,714,469,578,509,888,179],(function(){return t=34166,e(e.s=t);var t}));var t=e.O();_N_E=t}]);