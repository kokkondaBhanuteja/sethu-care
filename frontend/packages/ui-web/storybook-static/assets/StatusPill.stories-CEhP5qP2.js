import{c as o,j as e,a as p,b as x}from"./cn-BEvx_pq8.js";import"./iframe-qaRin-c7.js";import"./preload-helper-PPVm8Dsz.js";const f=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 6v6l4 2",key:"mmk7yg"}]],b=o("clock",f);const h=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]],P=o("shield-check",h),S=x("inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",{variants:{tone:{success:"bg-success-bg text-success-fg",warning:"bg-warning-bg text-warning-fg",danger:"bg-danger-bg text-danger-fg",info:"bg-info-bg text-info-fg",neutral:"bg-neutral-bg text-neutral-fg",brand:"bg-info-bg text-primary"},size:{sm:"px-2 py-0.5 text-[11px]",md:"px-2.5 py-1 text-xs"},outlined:{true:"",false:""}},compoundVariants:[{tone:"success",outlined:!0,className:"border border-success-border"},{tone:"warning",outlined:!0,className:"border border-warning-border"},{tone:"danger",outlined:!0,className:"border border-danger-border"},{tone:"info",outlined:!0,className:"border border-info-border"},{tone:"neutral",outlined:!0,className:"border border-neutral-border"},{tone:"brand",outlined:!0,className:"border border-info-border"}],defaultVariants:{tone:"neutral",size:"md",outlined:!1}});function n({tone:i,size:l,outlined:c,icon:d,className:u,children:m,...g}){return e.jsxs("span",{className:p(S({tone:i,size:l,outlined:c}),u),...g,children:[d,m]})}n.__docgenInfo={description:"",methods:[],displayName:"StatusPill",props:{icon:{required:!1,tsType:{name:"ReactNode"},description:"Optional leading 16px lucide icon."}},composes:["HTMLAttributes","VariantProps"]};const N={title:"UI/StatusPill",component:n,tags:["autodocs"],args:{children:"Status"}},s={render:()=>e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(n,{tone:"success",children:"Paid Via Card"}),e.jsx(n,{tone:"warning",children:"Due in 10 Days"}),e.jsx(n,{tone:"danger",children:"Due in 3 days"}),e.jsx(n,{tone:"info",children:"In Progress"}),e.jsx(n,{tone:"neutral",children:"Pending"}),e.jsx(n,{tone:"brand",children:"Assigned"})]})},r={render:()=>e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(n,{tone:"warning",icon:e.jsx(b,{}),children:"2 Days left to clear"}),e.jsx(n,{tone:"success",icon:e.jsx(P,{}),children:"Completed (Admin Verified)"})]})},t={args:{tone:"success",outlined:!0,children:"Paid Via Cash"}},a={args:{tone:"danger",size:"sm",children:"Expired"}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-wrap items-center gap-2">
      <StatusPill tone="success">Paid Via Card</StatusPill>
      <StatusPill tone="warning">Due in 10 Days</StatusPill>
      <StatusPill tone="danger">Due in 3 days</StatusPill>
      <StatusPill tone="info">In Progress</StatusPill>
      <StatusPill tone="neutral">Pending</StatusPill>
      <StatusPill tone="brand">Assigned</StatusPill>
    </div>
}`,...s.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-wrap items-center gap-2">
      <StatusPill tone="warning" icon={<Clock />}>
        2 Days left to clear
      </StatusPill>
      <StatusPill tone="success" icon={<ShieldCheck />}>
        Completed (Admin Verified)
      </StatusPill>
    </div>
}`,...r.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    tone: "success",
    outlined: true,
    children: "Paid Via Cash"
  }
}`,...t.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    tone: "danger",
    size: "sm",
    children: "Expired"
  }
}`,...a.parameters?.docs?.source}}};const k=["Tones","WithIcon","Outlined","Small"];export{t as Outlined,a as Small,s as Tones,r as WithIcon,k as __namedExportsOrder,N as default};
