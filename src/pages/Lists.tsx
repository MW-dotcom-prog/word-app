import { useNavigate } from 'react-router-dom';
import { ErrorState, LoadingState, ProgressBar } from '../components/Common';
import { Icon } from '../components/Icon';
import { loadListKeys, loadMeta } from '../lib/data';
import { getLearnedCount } from '../lib/selectors';
import { useAsync } from '../lib/useAsync';
import { useAppState } from '../state/AppState';

export default function ListsPage() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();

  const metaState = useAsync(loadMeta, []);
  const keysState = useAsync(async () => {
    if (!metaState.data) return {} as Record<string, string[]>;
    const pairs = await Promise.all(
      metaState.data.lists.map(async (list) => {
        const keys = await loadListKeys(list.id);
        return [list.id, keys] as const;
      }),
    );
    return Object.fromEntries(pairs) as Record<string, string[]>;
  }, [metaState.data]);

  const error = metaState.error ?? keysState.error;
  if (error) {
    return (
      <div className="page">
        <ErrorState message={error.message} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const allListsLoaded = Boolean(
    metaState.data &&
      keysState.data &&
      metaState.data.lists.every((list) => Array.isArray(keysState.data?.[list.id])),
  );

  if (metaState.loading || keysState.loading || !metaState.data || !allListsLoaded) {
    return (
      <div className="page">
        <LoadingState label="正在加载词库…" />
      </div>
    );
  }

  const handleSelect = (listId: string) => {
    if (listId !== state.settings.activeListId) {
      dispatch({ type: 'setActiveList', listId });
    }
    navigate('/');
  };

  return (
    <div className="page lists-page">
      <header className="page-header">
        <p className="eyebrow">WORD LISTS</p>
        <h1 className="page-title">选择词库</h1>
        <p className="page-subtitle">切换词库不会丢失学习进度，已学过的词不会重复出现。</p>
      </header>

      <section className="panel study-order-panel">
        <div className="section-heading">
          <h2>学习顺序</h2>
          <span className="muted small">
            {state.settings.studyOrder === 'random' ? '乱序' : '按顺序'}
          </span>
        </div>
        <p className="muted small panel-description">
          新词和复习都会使用这个顺序，修改后从下一次学习开始生效。
        </p>
        <div className="goal-options">
          <button
            type="button"
            className={state.settings.studyOrder === 'sequential' ? 'is-active' : ''}
            onClick={() => dispatch({ type: 'setStudyOrder', order: 'sequential' })}
          >
            <Icon name="book" size={15} />
            按顺序
          </button>
          <button
            type="button"
            className={state.settings.studyOrder === 'random' ? 'is-active' : ''}
            onClick={() => dispatch({ type: 'setStudyOrder', order: 'random' })}
          >
            <Icon name="shuffle" size={15} />
            乱序
          </button>
        </div>
      </section>

      <div className="list-stack">
        {metaState.data.lists.map((list) => {
          const keys = keysState.data?.[list.id] ?? [];
          const learned = getLearnedCount(keys, state.progress);
          const isActive = list.id === state.settings.activeListId;
          const complete = keys.length > 0 && learned >= keys.length;
          return (
            <button
              key={list.id}
              type="button"
              className={`list-card list-${list.id}${isActive ? ' is-active' : ''}`}
              onClick={() => handleSelect(list.id)}
            >
              <div className="list-card-head">
                <span className="list-badge">{list.short}</span>
                <span className="list-card-status">
                  {isActive ? (
                    <span className="active-badge">
                      <Icon name="check" size={13} />
                      当前
                    </span>
                  ) : (
                    <Icon name="chevron-right" size={18} />
                  )}
                </span>
              </div>
              <h2>{list.name}</h2>
              <p className="list-description">{list.description}</p>
              <div className="list-progress-row">
                <ProgressBar value={learned} max={keys.length} label={`${list.name}学习进度`} />
                <span>
                  {learned} / {keys.length}
                </span>
              </div>
              <div className="list-card-foot">
                <span>共 {list.count.toLocaleString('zh-CN')} 词</span>
                <span className={complete ? 'list-complete' : ''}>
                  {complete ? '已全部学过' : `剩余 ${Math.max(0, keys.length - learned)} 词`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <section className="panel review-curve-panel">
        <div className="section-heading">
          <h2>复习节奏</h2>
          <span className="muted small">艾宾浩斯</span>
        </div>
        <p className="muted small panel-description">
          新词次日首次复习，之后按 2 / 4 / 7 / 15 / 30 / 60 天的间隔逐步拉长；忘记的词会更早回来。
        </p>
      </section>

      <p className="page-note">
        词库包含高考、雅思、托福、四级和六级，学习进度在词库之间共享。
      </p>
    </div>
  );
}
