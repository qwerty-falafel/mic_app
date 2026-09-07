import React, { useEffect, useState } from 'react';
import { api, post, type Row } from './api';
import { navigate, productPath, type ProductSection } from './router';

const sections: Array<[ProductSection, string]> = [['overview','Overview'],['roadmap','Roadmap'],['briefs','Briefs'],['backlog','Backlog'],['board','Board'],['sprints','Sprints'],['releases','Releases'],['activity','Activity'],['settings','Product settings']];

export function ProductWorkspace(p: Row) {
  const [detail, setDetail] = useState<Row>({ goals: [], features: [], repositories: [], deliveries: [] });
  const [sprints, setSprints] = useState<Row[]>([]), [increments, setIncrements] = useState<Row[]>([]);
  const load = async () => { const [d, s, i] = await Promise.all([api(`/products/${p.product.slug}`), api(`/scrum-sprints?projectId=${p.product.id}`), api(`/increments?projectId=${p.product.id}`)]); setDetail(d); setSprints(s); setIncrements(i); };
  useEffect(() => { void load() }, [p.product.id]);
  const base = productPath(p.product.slug), activeGoal = detail.goals?.find((x: Row) => x.status === 'active'), activeSprint = sprints.find(x => x.status === 'active');
  return <><section className="productHeader"><small>PRODUCT</small><h1>{p.product.name}</h1><p>{p.product.purpose || 'This Product’s purpose has not been recorded yet.'}</p></section><nav className="productTabs" aria-label="Product workspace">{sections.map(([key,label]) => <button key={key} className={p.section === key ? 'selected' : ''} aria-current={p.section === key ? 'page' : undefined} onClick={() => navigate(key === 'overview' ? base : `${base}/${key}`)}>{label}</button>)}</nav>{p.section === 'overview' ? <Overview {...p} detail={detail} activeGoal={activeGoal} activeSprint={activeSprint} increments={increments} /> : <WorkspaceSection {...p} detail={detail} sprints={sprints} increments={increments} reload={load} />}</>;
}

function Overview(p: Row) {
  const attention = p.streams.map((x: Row) => ({ stream: x, lifecycle: p.deliveryStates[x.id] })).filter((x: Row) => x.lifecycle?.attention);
  return <><div className="overviewGrid"><section className="panel"><small>PRODUCT GOAL</small><h2>{p.activeGoal?.statement ?? 'No active Product Goal'}</h2><p>{p.activeGoal ? 'The single current direction for Product Backlog decisions.' : 'Set a Product Goal in Product settings.'}</p></section><section className="panel"><small>CURRENT SPRINT</small><h2>{p.activeSprint ? `Sprint ${p.activeSprint.number}` : 'No active Sprint'}</h2><p>{p.activeSprint?.goal ?? 'Use Sprints when a Scrum Team is ready to make a timeboxed commitment.'}</p></section></div><section className="panel"><div className="head"><h2>Needs attention</h2><span className="status">{attention.length}</span></div>{attention.length ? attention.map(({stream,lifecycle}: Row) => <button className="row" key={stream.id} onClick={() => p.openDelivery(stream.id)}><span className="status awaiting-decision">{lifecycle.currentStage?.state}</span><span><b>{lifecycle.recommendedAction?.label ?? stream.title}</b><small>{stream.title} · {lifecycle.currentStage?.label}</small></span></button>) : <div className="empty">No Product decision is waiting.</div>}</section><div className="overviewGrid"><section className="panel"><h2>Active delivery</h2>{p.streams.length ? p.streams.map((stream: Row) => <button className="row" key={stream.id} onClick={() => p.openDelivery(stream.id)}><span className="status">{p.deliveryStates[stream.id]?.currentStage?.state ?? stream.status}</span><span><b>{stream.title}</b><small>{p.deliveryStates[stream.id]?.recommendedAction?.label ?? 'Open delivery'}</small></span></button>) : <div className="empty">No delivery has started.</div>}</section><section className="panel"><h2>Latest usable Increment</h2>{p.increments[0] ? <><h3>{p.increments[0].title}</h3><p>{p.increments[0].description}</p></> : <div className="empty">No usable Increment has been recorded.</div>}<details><summary>Definition of Done</summary><p>{p.detail.product?.definitionOfDone}</p></details></section></div></>;
}

function WorkspaceSection(p: Row) {
  return <section className="panel sectionPlaceholder"><small>{String(p.section).toUpperCase()}</small><h2>{sections.find(([key]) => key === p.section)?.[1]}</h2><p>This stable Product route is ready for its dedicated Sprint increment.</p></section>;
}
