import{c as r,j as e}from"./cn-BEvx_pq8.js";import{I as n}from"./IconChip-MX6LHZfc.js";import"./iframe-qaRin-c7.js";import"./preload-helper-PPVm8Dsz.js";const t=[["path",{d:"M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z",key:"pzmjnu"}],["path",{d:"M21.21 15.89A10 10 0 1 1 8 2.83",key:"k2fpak"}]],i=r("chart-pie",t);const d=[["rect",{width:"20",height:"14",x:"2",y:"5",rx:"2",key:"ynyp8z"}],["line",{x1:"2",x2:"22",y1:"10",y2:"10",key:"1b3vmo"}]],p=r("credit-card",d);const h=[["circle",{cx:"8",cy:"21",r:"1",key:"jimo8o"}],["circle",{cx:"19",cy:"21",r:"1",key:"13723u"}],["path",{d:"M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12",key:"9zh506"}]],l=r("shopping-cart",h);const m=[["path",{d:"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",key:"18etb6"}],["path",{d:"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",key:"xoc0q4"}]],a=r("wallet",m),j={title:"UI/IconChip",component:n,tags:["autodocs"],args:{children:e.jsx(a,{})}},o={render:()=>e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(n,{accent:"green",look:"solid",label:"Orders",children:e.jsx(i,{})}),e.jsx(n,{accent:"red",look:"solid",label:"Returns",children:e.jsx(p,{})}),e.jsx(n,{accent:"blue",look:"solid",label:"Amount",children:e.jsx(a,{})})]})},c={render:()=>e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(n,{accent:"amber",look:"soft",label:"Admin",children:e.jsx(l,{})}),e.jsx(n,{accent:"green",look:"soft",label:"Sales",children:e.jsx(l,{})}),e.jsx(n,{accent:"purple",look:"soft",label:"Pharmacy",children:e.jsx(l,{})})]})},s={render:()=>e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(n,{accent:"brand",look:"soft",size:"sm",label:"Small",children:e.jsx(a,{})}),e.jsx(n,{accent:"brand",look:"soft",size:"md",label:"Medium",children:e.jsx(a,{})}),e.jsx(n,{accent:"brand",look:"solid",size:"lg",label:"Large",children:e.jsx(a,{})})]})};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-3">
      <IconChip accent="green" look="solid" label="Orders">
        <PieChart />
      </IconChip>
      <IconChip accent="red" look="solid" label="Returns">
        <CreditCard />
      </IconChip>
      <IconChip accent="blue" look="solid" label="Amount">
        <Wallet />
      </IconChip>
    </div>
}`,...o.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-3">
      <IconChip accent="amber" look="soft" label="Admin">
        <ShoppingCart />
      </IconChip>
      <IconChip accent="green" look="soft" label="Sales">
        <ShoppingCart />
      </IconChip>
      <IconChip accent="purple" look="soft" label="Pharmacy">
        <ShoppingCart />
      </IconChip>
    </div>
}`,...c.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-3">
      <IconChip accent="brand" look="soft" size="sm" label="Small">
        <Wallet />
      </IconChip>
      <IconChip accent="brand" look="soft" size="md" label="Medium">
        <Wallet />
      </IconChip>
      <IconChip accent="brand" look="solid" size="lg" label="Large">
        <Wallet />
      </IconChip>
    </div>
}`,...s.parameters?.docs?.source}}};const g=["Solid","Soft","Sizes"];export{s as Sizes,c as Soft,o as Solid,g as __namedExportsOrder,j as default};
