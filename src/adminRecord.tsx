import {useEffect,useRef} from 'react'
import {fieldLabel,presentValue} from './adminPresentation'
export default function RecordDetails({row,title,onClose,labels}:{row:Record<string,unknown>;title:string;onClose:()=>void;labels:Record<string,string>}){
 const dialog=useRef<HTMLDialogElement>(null)
 useEffect(()=>{dialog.current?.showModal()},[])
 const priority=['name_pt','name','first_name','last_name','title_pt','sku','status','kind','sales_mode','price_cents','amount_cents','quantity','email','phone','summary_pt','description_pt']
 const entries=Object.entries(row).sort(([a],[b])=>(priority.includes(a)?priority.indexOf(a):100)-(priority.includes(b)?priority.indexOf(b):100))
 const reference=(key:string)=>key==='id'||key.endsWith('_id')||['training_batch','request_key'].includes(key)
 const complex=(value:unknown)=>typeof value==='object'&&value!==null
 const field=(key:string,value:unknown)=><div className={presentValue(key,value).length>120?'record-wide':undefined} key={key}><dt>{labels[key]??fieldLabel(key)}</dt><dd>{presentValue(key,value)}</dd></div>
 return <dialog ref={dialog} className="sale-detail record-detail" onCancel={onClose} aria-label={`Detalhes · ${title}`}><header><div><small>{title.toLocaleUpperCase('pt-BR')}</small><h2>{String(row.name_pt??row.name??row.title_pt??'Detalhes do registro')}</h2></div><button autoFocus type="button" className="secondary-button" onClick={onClose}>Fechar</button></header>{row.is_training===true&&<div className="training-notice">Treinamento · dados fictícios</div>}<dl className="sale-info">{entries.filter(([key,value])=>!reference(key)&&!complex(value)).map(([key,value])=>field(key,value))}</dl>{entries.filter(([key,value])=>!reference(key)&&complex(value)).map(([key,value])=><details key={key}><summary>{labels[key]??fieldLabel(key)}</summary><pre>{presentValue(key,value)}</pre></details>)}{entries.some(([key])=>reference(key))&&<details><summary>Referências do registro</summary><dl className="sale-info">{entries.filter(([key])=>reference(key)).map(([key,value])=>field(key,value))}</dl></details>}</dialog>
}
