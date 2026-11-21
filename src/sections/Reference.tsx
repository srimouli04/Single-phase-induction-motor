import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ModelBadge } from '../components/Badges';
import { ResetButton, Segmented } from '../components/Controls';
import { Eq, Rich } from '../components/Eq';
import { Page } from '../components/Page';
import { FORMULAS, FORMULA_GROUPS, searchFormulas, searchGlossary, type FormulaGroupId } from '../content/formulas';
import { GLOSSARY, getTerm } from '../content/glossary';
import { useApp } from '../state';
import FormulaCard from './reference/FormulaCard';

type GroupFilter = FormulaGroupId | 'all';
const GROUP_IDS = Object.keys(FORMULA_GROUPS) as FormulaGroupId[];
const GROUP_OPTIONS: { value: GroupFilter; label: string }[] = [{ value: 'all', label: 'All' }, ...GROUP_IDS.map((value) => ({ value, label: FORMULA_GROUPS[value] }))];

export default function Reference() {
  const { navigate } = useApp();
  const inputId = useId();
  const hintId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<GroupFilter>('all');
  const [hit, setHit] = useState<string | null>(null); // the glossary term the last "Glossary:" link pointed at
  const [scrollTo, setScrollTo] = useState<string | null>(null); // element id to bring into view once the lists have re-rendered

  const formulas = useMemo(() => searchFormulas(query, group), [query, group]);
  const terms = useMemo(() => searchGlossary(query), [query]);
  const groups = GROUP_IDS.map((id) => ({ id, items: formulas.filter((f) => f.group === id) })).filter((g) => g.items.length > 0);
  const filtered = query.trim() !== '' || group !== 'all';
  const none = formulas.length === 0 && terms.length === 0;

  useEffect(() => {
    if (!scrollTo) return;
    const el = document.getElementById(scrollTo);
    el?.scrollIntoView({ block: 'start' }); // follows the page's smooth-scroll setting, which is off for reduced motion
    el?.focus({ preventScroll: true });
    setScrollTo(null);
  }, [scrollTo]);

  const clear = () => {
    setQuery('');
    setGroup('all');
    setHit(null);
    searchRef.current?.focus(); // the Clear button disappears, so keep the keyboard where it was
  };
  const showTerm = (id: string) => {
    if (!terms.some((t) => t.id === id)) setQuery(''); // the search had hidden that term
    setHit(id);
    setScrollTo(`gl-${id}`);
  };

  return (
    <Page id="reference">
      <ModelBadge kinds={['analytical']}>Relations with stated assumptions. Each worked example uses the example motor of the Physics lab, and its numbers are computed by the same code.</ModelBadge>

      <section className="panel" aria-labelledby="rf-find">
        <h2 id="rf-find">Find a formula or a term</h2>
        <div className="ref-controls">
          <div className="ref-search">
            <label htmlFor={inputId}>Search the formulas and the glossary</label>
            <input
              id={inputId}
              ref={searchRef}
              type="search"
              value={query}
              autoComplete="off"
              spellCheck={false}
              placeholder="slip, capacitor, N_s, power factor"
              aria-describedby={hintId}
              onChange={(e) => {
                setQuery(e.target.value);
                setHit(null);
              }}
            />
            <p id={hintId} className="muted small">
              Type a name, a symbol such as <Eq>N_s</Eq>, or a word such as “capacitor”. Every word you type has to match.
            </p>
          </div>
          <Segmented label="Formula group" options={GROUP_OPTIONS} value={group} onChange={setGroup} />
          {filtered && <ResetButton label="Clear search" onClick={clear} />}
        </div>
        <p className="muted small" role="status">
          Showing {formulas.length} of {FORMULAS.length} formulas and {terms.length} of {GLOSSARY.length} glossary terms.
        </p>
        {!none && (
          <p className="ref-jump">
            <button type="button" className="link" onClick={() => setScrollTo('ref-formulas')}>
              Go to the formula sheet
            </button>
            <button type="button" className="link" onClick={() => setScrollTo('ref-glossary')}>
              Go to the glossary
            </button>
          </p>
        )}
      </section>

      {none ? (
        <div className="state" role="status">
          <p>
            <strong>Nothing matches “{query.trim()}”{group !== 'all' && ` in ${FORMULA_GROUPS[group]}`}.</strong>
          </p>
          <p>
            Try a shorter word, a symbol such as <Eq>N_s</Eq> or <Eq>T_f</Eq>, or fewer words.
          </p>
          <button type="button" className="btn" onClick={clear}>
            Clear search
          </button>
        </div>
      ) : (
        <>
          <h2 id="ref-formulas" className="ref-head" tabIndex={-1}>
            Formula sheet
          </h2>
          {groups.length === 0 && <p className="muted">No formula matches. The glossary below may help.</p>}
          {groups.map((g) => (
            <section key={g.id} aria-labelledby={`rg-${g.id}`}>
              <h3 id={`rg-${g.id}`} className="ref-group">
                {FORMULA_GROUPS[g.id]} <span className="muted">({g.items.length})</span>
              </h3>
              <div className="ref-cards">
                {g.items.map((f) => (
                  <FormulaCard key={f.id} f={f} onTerm={showTerm} onTry={(t) => navigate(t.target, t.handoff)} />
                ))}
              </div>
            </section>
          ))}

          <h2 id="ref-glossary" className="ref-head" tabIndex={-1}>
            Glossary
          </h2>
          {terms.length === 0 && <p className="muted">No glossary term matches. The formulas above may help.</p>}
          <dl className="ref-glossary">
            {terms.map((g) => (
              <div key={g.id} id={`gl-${g.id}`} className={`ref-term${hit === g.id ? ' hit' : ''}`} tabIndex={-1}>
                <dt>
                  <Rich>{g.term}</Rich>
                </dt>
                <dd>
                  <p>
                    <Rich>{g.short}</Rich>
                  </p>
                  <p className="muted">
                    <Rich>{g.long}</Rich>
                  </p>
                  {g.related && g.related.length > 0 && (
                    <p className="small">
                      <span className="muted">See also: </span>
                      {g.related.map((id, i) => (
                        <span key={id}>
                          {i > 0 && ', '}
                          <button type="button" className="link" onClick={() => showTerm(id)}>
                            <Rich>{getTerm(id)?.term ?? id}</Rich>
                          </button>
                        </span>
                      ))}
                    </p>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </Page>
  );
}
