const PptxGenJS = require('pptxgenjs');
const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
const slide = pptx.addSlide();
slide.addText('hello', { x:1, y:1, w:3, h:1, fontSize:24 });
pptx.writeFile({ fileName: 'smoke_test.pptx' }).then(()=>console.log('ok')).catch(err=>{console.error(err);process.exit(1);});
