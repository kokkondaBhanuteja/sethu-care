import{c as m,j as e,a as s,b}from"./cn-BEvx_pq8.js";import{B as l,R as g}from"./Button-D_Ihr3S7.js";import{I as p}from"./IconChip-MX6LHZfc.js";import"./iframe-qaRin-c7.js";import"./preload-helper-PPVm8Dsz.js";const C=[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]],f=m("chart-column",C);const j=[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]],y=m("triangle-alert",j),N=b("rounded-card border shadow-card",{variants:{tone:{plain:"border-border bg-surface",amber:"border-tint-amber-border bg-tint-amber-bg",green:"border-tint-green-border bg-tint-green-bg",purple:"border-tint-purple-border bg-tint-purple-bg",blue:"border-tint-blue-border bg-tint-blue-bg",danger:"border-danger-border bg-danger-bg"}},defaultVariants:{tone:"plain"}});function o({className:r,tone:t,...i}){return e.jsx("div",{className:s(N({tone:t}),r),...i})}function d({icon:r,actions:t,className:i,children:x,...h}){return e.jsxs("div",{className:s("flex flex-wrap items-center gap-3 p-4 sm:p-5",i),...h,children:[r,e.jsx("div",{className:"min-w-0 flex-1 text-base font-semibold text-ink",children:x}),t?e.jsx("div",{className:"flex shrink-0 items-center gap-2",children:t}):null]})}function c({className:r,...t}){return e.jsx("div",{className:s("px-4 pb-4 sm:px-5 sm:pb-5",r),...t})}function u({className:r,...t}){return e.jsx("div",{className:s("flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5",r),...t})}o.__docgenInfo={description:"",methods:[],displayName:"Card",composes:["HTMLAttributes","VariantProps"]};d.__docgenInfo={description:"",methods:[],displayName:"CardHeader",props:{icon:{required:!1,tsType:{name:"ReactNode"},description:"Leading visual — typically an <IconChip>."},actions:{required:!1,tsType:{name:"ReactNode"},description:'Right-aligned per-card controls (refresh, "View report", "Download CSV"…).'}},composes:["HTMLAttributes"]};c.__docgenInfo={description:"",methods:[],displayName:"CardContent"};u.__docgenInfo={description:"",methods:[],displayName:"CardFooter"};const R={title:"UI/Card",component:o,tags:["autodocs"]},a={render:()=>e.jsxs(o,{className:"w-[36rem] max-w-full",children:[e.jsx(d,{icon:e.jsx(p,{accent:"amber",look:"soft",children:e.jsx(y,{})}),actions:e.jsxs(e.Fragment,{children:[e.jsx(l,{variant:"ghost",size:"icon","aria-label":"Refresh",children:e.jsx(g,{})}),e.jsx(l,{variant:"outline",size:"sm",children:"View Report"})]}),children:"Expiry Alert"}),e.jsx(c,{className:"text-sm text-muted",children:"Card content composes tables, charts and lists here."}),e.jsx(u,{className:"text-xs text-faint",children:"Page 1 of 3"})]})},n={render:()=>e.jsx("div",{className:"grid w-[52rem] max-w-full gap-4 sm:grid-cols-3",children:[["amber","Bookings"],["green","Providers"],["purple","Payments"]].map(([r,t])=>e.jsxs(o,{tone:r,children:[e.jsx(d,{icon:e.jsx(p,{accent:r==="amber"?"amber":r==="green"?"green":"purple",look:"solid",children:e.jsx(f,{})}),children:t}),e.jsx(c,{className:"text-sm text-muted",children:"View comprehensive analytics and key metrics."})]},r))})};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: () => <Card className="w-[36rem] max-w-full">
      <CardHeader icon={<IconChip accent="amber" look="soft">
            <TriangleAlert />
          </IconChip>} actions={<>
            <Button variant="ghost" size="icon" aria-label="Refresh">
              <RefreshCw />
            </Button>
            <Button variant="outline" size="sm">
              View Report
            </Button>
          </>}>
        Expiry Alert
      </CardHeader>
      <CardContent className="text-sm text-muted">
        Card content composes tables, charts and lists here.
      </CardContent>
      <CardFooter className="text-xs text-faint">Page 1 of 3</CardFooter>
    </Card>
}`,...a.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: () => <div className="grid w-[52rem] max-w-full gap-4 sm:grid-cols-3">
      {([["amber", "Bookings"], ["green", "Providers"], ["purple", "Payments"]] as const).map(([tone, title]) => <Card key={tone} tone={tone}>
          <CardHeader icon={<IconChip accent={tone === "amber" ? "amber" : tone === "green" ? "green" : "purple"} look="solid">
                <ChartColumn />
              </IconChip>}>
            {title}
          </CardHeader>
          <CardContent className="text-sm text-muted">
            View comprehensive analytics and key metrics.
          </CardContent>
        </Card>)}
    </div>
}`,...n.parameters?.docs?.source}}};const V=["WithHeaderActions","FeatureTints"];export{n as FeatureTints,a as WithHeaderActions,V as __namedExportsOrder,R as default};
