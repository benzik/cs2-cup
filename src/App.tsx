import { useState, useRef, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { toPng } from 'html-to-image';
import { Camera, Lock, Edit3, Save, X, CheckCircle, AlertCircle, RotateCcw, ChevronDown, Trophy, Award, Shield, Crosshair, ArrowRight, UserX, History, TrendingUp, Flag, PlusCircle } from 'lucide-react';

const TEAMS_A = ['BIS', 'KM', 'PRK'];
const TEAMS_B = ['CAS', 'TAA', 'DNM'];
const CS2_MAPS = ['Mirage', 'Inferno', 'Nuke', 'Overpass', 'Vertigo', 'Ancient', 'Anubis', 'Dust II', 'Train', 'Cache'];

const ROSTERS: Record<string, string[]> = {
  'BIS': ['BIS.creo', 'FGA', 'MME.creo', 'BDR', 'GEA'],
  'KM': ['KM', 'ZIP', 'GER', 'ESI', 'PDA'],
  'PRK': ['PRK.farm', 'PMA', 'TDA.tech', 'DVB', 'BAO'],
  'CAS': ['CAS', 'ANA.creo', 'ARA', 'SIA', 'AAI.tech'],
  'TAA': ['TAA', 'REG', 'GMA', 'AAZ', 'ALY'],
  'DNM': ['DNM.tech', 'SVS.CREO', 'АА', 'DAM', 'SAA']
};

const TeamClickContext = createContext<((team: string) => void) | null>(null);
const RostersContext = createContext<Record<string, string[]>>(ROSTERS);

const TeamLabel = ({ team, align = 'left', colorClass = 'text-white' }: { team: string, align?: 'left'|'right', colorClass?: string }) => {
  const onTeamClick = useContext(TeamClickContext);
  const rosters = useContext(RostersContext);
  const roster = rosters[team];
  const canClick = !!onTeamClick && team !== 'TBD';
  const wrapperClass = `group relative flex-1 flex items-center min-w-0 ${align === 'right' ? 'justify-end' : 'justify-start'}`;
  const textClass = `truncate transition-colors ${colorClass} ${canClick ? 'cursor-pointer hover:underline underline-offset-2 decoration-dotted' : 'cursor-default'}`;

  const content = <span className={textClass} onClick={() => canClick && onTeamClick(team)}>{team}</span>;

  if (!roster) return <div className={wrapperClass}>{content}</div>;

  return (
    <div className={wrapperClass}>
      {content}
      <div className="absolute z-[9999] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-density-bg border border-density-accent shadow-[0_0_10px_rgba(255,5,140,0.25)] text-white text-[10px] p-2 rounded w-40 left-1/2 bottom-full mb-2 -translate-x-1/2 flex flex-col gap-1 items-center">
        <div className="font-bold text-density-accent mb-1 uppercase tracking-widest border-b border-density-accent/30 w-full text-center pb-1">{team} Roster</div>
        {roster.map(player => (
          <div key={player} className="text-density-text truncate w-full text-center">{player}</div>
        ))}
        {/* Triangle arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-density-accent" style={{ marginTop: '0px' }}></div>
      </div>
    </div>
  );
};

type MapScore = { t1: number | ''; t2: number | ''; mapName?: string };
type MatchData = { maps: [MapScore, MapScore, MapScore], isFinished?: boolean, savedAt?: string, mapsSaved?: [string|null,string|null,string|null] };
type GroupState = Record<string, MatchData>;
type RosterChange = { team: string; playerIdx: number; oldPlayer: string; newPlayer: string; changedAt: string };
type LogEdit = { hidden: string[]; overrides: Record<string,string>; custom: Array<{id:string;text:string;timestamp:string;type:LogEventType}> };

const createInitialMatch = (): MatchData => ({
  maps: [{ t1: '', t2: '', mapName: '' }, { t1: '', t2: '', mapName: '' }, { t1: '', t2: '', mapName: '' }],
  isFinished: false
});

const INITIAL_MATCHES_A: GroupState = {
  'BIS-KM': createInitialMatch(),
  'BIS-PRK': createInitialMatch(),
  'KM-PRK': createInitialMatch(),
};

const INITIAL_MATCHES_B: GroupState = {
  'CAS-TAA': createInitialMatch(),
  'CAS-DNM': createInitialMatch(),
  'TAA-DNM': createInitialMatch(),
};

type AppState = {
  matchesA: GroupState;
  matchesB: GroupState;
  semifinal1: MatchData;
  semifinal2: MatchData;
  final: MatchData;
  thirdPlaceMatch: MatchData;
  rosters?: Record<string, string[]>;
  rosterChanges?: RosterChange[];
  logEdit?: LogEdit;
  eventName?: string;
};

const INITIAL_STATE: AppState = {
  matchesA: INITIAL_MATCHES_A,
  matchesB: INITIAL_MATCHES_B,
  semifinal1: createInitialMatch(),
  semifinal2: createInitialMatch(),
  final: createInitialMatch(),
  thirdPlaceMatch: createInitialMatch(),
  rosters: { ...ROSTERS },
  rosterChanges: [],
  logEdit: { hidden: [], overrides: {}, custom: [] },
  eventName: 'LIDERA CUP 2026'
};

const getMatchResult = (match: MatchData) => {
  let t1Wins = 0;
  let t2Wins = 0;
  let t1Rounds = 0;
  let t2Rounds = 0;

  const maps = match?.maps || [];
  maps.forEach(m => {
    if (m.t1 !== '' && m.t2 !== '') {
      t1Rounds += Number(m.t1);
      t2Rounds += Number(m.t2);
      if (Number(m.t1) > Number(m.t2)) t1Wins++;
      else if (Number(m.t2) > Number(m.t1)) t2Wins++;
    }
  });
  return { t1Wins, t2Wins, t1Rounds, t2Rounds, isFinished: !!match?.isFinished };
}

const getGroupStats = (teams: string[], groupState: GroupState) => {
  return teams.map(team => {
    let matchWins = 0;
    let matchLosses = 0;
    let mapsWon = 0;
    let mapsLost = 0;
    let roundsDiff = 0;

    Object.entries(groupState).forEach(([matchId, data]) => {
      const [t1, t2] = matchId.split('-');
      if (t1 === team || t2 === team) {
        const res = getMatchResult(data);
        if (res.isFinished) {
          if (t1 === team) {
            mapsWon += res.t1Wins;
            mapsLost += res.t2Wins;
            roundsDiff += (res.t1Rounds - res.t2Rounds);
            if (res.t1Wins > res.t2Wins) matchWins++;
            else if (res.t2Wins > res.t1Wins) matchLosses++;
          } else {
            mapsWon += res.t2Wins;
            mapsLost += res.t1Wins;
            roundsDiff += (res.t2Rounds - res.t1Rounds);
            if (res.t2Wins > res.t1Wins) matchWins++;
            else if (res.t1Wins > res.t2Wins) matchLosses++;
          }
        }
      }
    });

    return { team, matchWins, matchLosses, mapsWon, mapsLost, roundsDiff, pts: matchWins * 3 };
  }).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const bMapDiff = b.mapsWon - b.mapsLost;
    const aMapDiff = a.mapsWon - a.mapsLost;
    if (bMapDiff !== aMapDiff) return bMapDiff - aMapDiff;
    return b.roundsDiff - a.roundsDiff;
  });
};

type MapBtnState = {kind:'none'}|{kind:'unlock'}|{kind:'accept_map';mapIdx:number}|{kind:'accept_match';mapIdx:number};
function getMapBtnState(data:MatchData):MapBtnState{
  if(data.isFinished) return {kind:'unlock'};
  const ms=data.mapsSaved??[null,null,null];
  let t1w=0,t2w=0;
  for(let i=0;i<3;i++){
    if(ms[i]){const s1=Number(data.maps[i].t1),s2=Number(data.maps[i].t2);if(s1>s2)t1w++;else if(s2>s1)t2w++;}
  }
  const nextIdx=ms.findIndex(s=>s===null);
  if(nextIdx===-1) return {kind:'none'};
  const m=data.maps[nextIdx];
  if(m.t1===''||m.t2==='') return {kind:'none'};
  const s1=Number(m.t1),s2=Number(m.t2);
  if(s1===s2) return {kind:'none'};
  const nT1=t1w+(s1>s2?1:0),nT2=t2w+(s2>s1?1:0);
  return(nT1===2||nT2===2)?{kind:'accept_match',mapIdx:nextIdx}:{kind:'accept_map',mapIdx:nextIdx};
}

const MapInput = ({ val, onChange, canEdit, isExporting, isWinner, isLoser }: { val: number | '', onChange: (v: number | '') => void, canEdit: boolean, isExporting: boolean, isWinner?: boolean, isLoser?: boolean }) => (
  canEdit && !isExporting ? (
    <input
      type="number" value={val}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      className="w-7 h-7 text-center text-xs font-mono bg-density-bg border border-density-line text-density-accent rounded outline-none focus:border-density-accent appearance-none m-0"
      style={{ MozAppearance: 'textfield' }} // hide inner arrows
    />
  ) : (
    <div className={`w-7 h-7 flex items-center justify-center text-sm font-mono font-bold
      ${isWinner ? 'text-density-cyan' : isLoser ? 'text-red-400' : 'text-density-text-dim'}
    `}>
      {val !== '' ? val : '—'}
    </div>
  )
);

const MatchScorecard = ({ data, t1, t2, onChange, canEdit, isExporting }: { data: MatchData, t1: string, t2: string, onChange: (d: MatchData) => void, canEdit: boolean, isExporting: boolean }) => {
  const res = getMatchResult(data);
  const maps = data?.maps || [{t1:'',t2:'',mapName:''},{t1:'',t2:'',mapName:''},{t1:'',t2:'',mapName:''}];
  const isFinished = !!data?.isFinished;
  const mapsSaved = data?.mapsSaved ?? [null,null,null];
  const btnState = canEdit && !isExporting ? getMapBtnState(data) : {kind:'none'} as MapBtnState;
  
  return (
    <div className="flex flex-col gap-1 items-center p-3 rounded-xl border border-density-line w-full bg-density-card">
      {/* Series Score Header */}
      <div className="flex items-center justify-between w-full text-sm mb-2 pb-2 border-b border-density-line">
        <TeamLabel 
           team={t1} 
           align="left" 
           colorClass={isFinished ? (res.t1Wins > res.t2Wins ? 'text-density-cyan font-semibold' : 'text-density-text-dim') : t1 === 'TBD' ? 'text-density-text-dim/30 font-normal' : 'text-density-text font-medium'}
        />

        <div className="flex items-center flex-none px-3 min-w-[60px] justify-center">
          {isFinished ? (
            <span className="font-mono font-bold tabular-nums text-sm text-density-accent">
              {res.t1Wins} : {res.t2Wins}
            </span>
          ) : (t1 === 'TBD' || t2 === 'TBD') ? (
            <span className="text-[9px] text-density-text-dim/40 uppercase tracking-wider text-center leading-tight">
              ждём<br/>команды
            </span>
          ) : (
            <span className="text-[9px] text-density-text-dim/50 uppercase tracking-wider">
              предстоит
            </span>
          )}
        </div>

        <TeamLabel
           team={t2}
           align="right"
           colorClass={isFinished ? (res.t2Wins > res.t1Wins ? 'text-density-cyan font-semibold' : 'text-density-text-dim') : t2 === 'TBD' ? 'text-density-text-dim/30 font-normal' : 'text-density-text font-medium'} 
        />
      </div>
      
      {/* Map Scores List */}
      <div className="flex flex-col gap-1.5 w-full">
        {(() => {
          const accT1 = mapsSaved.reduce((n,ts,i)=>ts&&Number(maps[i]?.t1)>Number(maps[i]?.t2)?n+1:n,0);
          const accT2 = mapsSaved.reduce((n,ts,i)=>ts&&Number(maps[i]?.t2)>Number(maps[i]?.t1)?n+1:n,0);
          const decided = accT1===2||accT2===2;
          return maps.map((m, idx) => {
          const isMapLocked = !!mapsSaved[idx];
          const mapEditable = canEdit && !isMapLocked;
          const isMapEmpty = m.t1 === '' && m.t2 === '';
          if (!isMapLocked && decided) return null;
          if (isMapEmpty && (!canEdit || isExporting)) return null;

          const t1Val = m.t1 !== '' ? Number(m.t1) : -1;
          const t2Val = m.t2 !== '' ? Number(m.t2) : -1;
          const isMapFinished = m.t1 !== '' && m.t2 !== '' && t1Val !== t2Val;

          return (
            <div key={idx} className={`flex items-center justify-between border-b border-density-line/40 last:border-0 py-1 px-1 ${isMapLocked ? 'opacity-70' : ''}`}>
              <MapInput val={m.t1} canEdit={mapEditable} isExporting={isExporting} isWinner={isMapFinished && t1Val > t2Val} isLoser={isMapFinished && t1Val < t2Val} onChange={v => { const n = [...maps] as any; n[idx].t1 = v; onChange({...data, maps: n}); }} />
              
              <div className="flex-1 flex justify-center items-center gap-1 px-2">
                {mapEditable && !isExporting ? (
                  <select 
                    value={m.mapName || ''} 
                    onChange={e => { const n = [...maps] as any; n[idx].mapName = e.target.value; onChange({...data, maps: n}); }}
                    className="bg-transparent border border-density-line rounded-sm outline-none px-1 py-0.5 max-w-[120px] text-[10px] text-center text-density-text cursor-pointer focus:border-density-accent"
                  >
                    <option value="">MAP {idx+1}</option>
                    {CS2_MAPS.map(map => <option key={map} value={map} className="bg-density-bg text-white">{map}</option>)}
                  </select>
                ) : (
                  <span className="text-[11px] text-center text-density-text-dim px-2 truncate block overflow-hidden" style={{ maxWidth: '120px' }}>
                    {m.mapName || `Map ${idx+1}`}
                  </span>
                )}
              </div>

              <MapInput val={m.t2} canEdit={mapEditable} isExporting={isExporting} isWinner={isMapFinished && t2Val > t1Val} isLoser={isMapFinished && t2Val < t1Val} onChange={v => { const n = [...maps] as any; n[idx].t2 = v; onChange({...data, maps: n}); }} />
            </div>
          );
        });
        })()}
      </div>

      {/* Accept Map / Match Button */}
      {btnState.kind !== 'none' && (
        <button
          onClick={() => {
            const now = new Date().toISOString();
            if (btnState.kind === 'unlock') {
              onChange({...data, isFinished: false, savedAt: undefined, mapsSaved: [null, null, null]});
            } else {
              const ms = [...(data.mapsSaved ?? [null,null,null])] as [string|null,string|null,string|null];
              ms[btnState.mapIdx] = now;
              if (btnState.kind === 'accept_match') onChange({...data, mapsSaved: ms, isFinished: true, savedAt: now});
              else onChange({...data, mapsSaved: ms});
            }
          }}
          className={`w-full mt-2 py-1.5 rounded-md text-[11px] font-medium transition flex items-center justify-center gap-1 ${
            btnState.kind === 'unlock' ? 'text-density-text-dim hover:text-density-text border border-density-line' :
            btnState.kind === 'accept_match' ? 'bg-density-accent text-white hover:opacity-90' :
            'bg-density-accent/20 text-density-accent border border-density-accent/35 hover:bg-density-accent/30'
          }`}
        >
          {btnState.kind === 'unlock' ? 'Unlock Match' :
           btnState.kind === 'accept_match' ? 'Accept Match' :
           `Accept Map ${btnState.mapIdx + 1}`}
        </button>
      )}
      {isFinished && data.savedAt && !isExporting && (
        <div className="text-[9px] text-density-text-dim mt-1 text-center w-full opacity-60">
          {new Date(data.savedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      )}
    </div>
  );
};

const GroupWidget = ({ title, groupKey, teams, stats, appState, saveState, canEdit, isExporting }: any) => (
  <div className="bg-density-card border border-density-line rounded-xl p-5 flex-1 shadow-[0_2px_24px_rgba(0,0,0,0.45)]">
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-density-text-dim mb-4 border-b border-density-line pb-3">{title}</h2>
    
    {/* Standings Table */}
    <div className="mb-3 overflow-x-auto">
      <table className="w-full text-left text-xs whitespace-nowrap">
        <thead className="text-[10px] text-density-text-dim uppercase border-b border-density-line">
          <tr>
            <th className="py-1.5 pl-2 w-6">#</th>
            <th className="py-1.5 pr-2">Команда</th>
            <th className="py-1.5 px-2 text-center" title="Матчи: победы — поражения">М</th>
            <th className="py-1.5 px-2 text-center" title="Карты: победы — поражения">К</th>
            <th className="py-1.5 pl-2 pr-2 text-right text-density-accent">Очки</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s: any, idx: number) => (
            <tr key={s.team} className={`border-b border-density-line/50 last:border-0 ${idx < 2 ? 'bg-density-accent/5' : ''}`}>
              <td className="py-1.5 pl-2 font-mono text-[10px] text-density-text-dim">{idx + 1}</td>
              <td className="py-1.5 pr-2 font-medium">{s.team}</td>
              <td className="py-1.5 px-2 text-center font-mono">{s.matchWins}–{s.matchLosses}</td>
              <td className="py-1.5 px-2 text-center font-mono text-density-text-dim text-[10px]">{s.mapsWon}–{s.mapsLost}</td>
              <td className="py-1.5 pl-2 pr-2 text-right font-bold text-density-accent">{s.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="space-y-3">
      <div className="text-[10px] text-density-text-dim/60 mb-2">Matches · BO3</div>
      {Object.entries(appState[groupKey])
        .map(([matchId, data]: [string, any]) => {
          const [t1, t2] = matchId.split('-');
          return (
            <MatchScorecard
              key={matchId}
              t1={t1} t2={t2} data={data}
              canEdit={canEdit}
              isExporting={isExporting}
              onChange={(nd: MatchData) => saveState({ ...appState, [groupKey]: { ...appState[groupKey], [matchId]: nd } })}
            />
          );
        })}
    </div>
  </div>
);

const BracketNode = ({ team1, team2, data, onChange, title, isFinal=false, canEdit, isExporting, widthClass, isLocked }: any) => {
  return (
    <div className={`relative flex flex-col items-center z-10 ${widthClass || 'w-full max-w-[340px]'}`}>
      {title && (
        <div className={`text-[10px] font-extrabold uppercase tracking-[0.15em] text-center mb-2 px-3 py-1 rounded-md bg-density-bg border ${isFinal ? 'border-density-accent text-density-accent shadow-[0_0_8px_rgba(255,5,140,0.2)]' : 'border-density-line text-density-text-dim'} ${isLocked ? 'opacity-40' : ''}`}>
          {title}
        </div>
      )}
      <div className={`w-full flex justify-center ${isFinal ? 'shadow-[0_0_14px_rgba(255,5,140,0.1)] rounded-lg' : ''}`}>
        <MatchScorecard t1={team1} t2={team2} data={data} onChange={onChange} canEdit={canEdit} isExporting={isExporting} />
      </div>
    </div>
  );
};

type PlayoffMatchInfo = { stage: string; t1: string; t2: string; data: MatchData };
type TeamMatchEntry  = { stage: string; opponent: string; data: MatchData; isTeam1: boolean };

const TeamModal = ({ team, appState, playoffMatches, onClose, canEdit, onRosterSave }: {
  team: string;
  appState: AppState;
  playoffMatches: PlayoffMatchInfo[];
  onClose: () => void;
  canEdit: boolean;
  onRosterSave: (team: string, newRoster: string[], sub?: { playerIdx: number; oldPlayer: string; newPlayer: string }) => void;
}) => {
  const currentRosters = { ...ROSTERS, ...appState.rosters };
  const roster = currentRosters[team];
  const teamSubs = (appState.rosterChanges || []).filter(c => c.team === team);

  const [editRoster, setEditRoster] = useState<string[]>([...(roster || [])]);
  const [pendingChange, setPendingChange] = useState<{ idx: number; oldVal: string } | null>(null);

  const confirmChange = (type: 'typo' | 'sub') => {
    if (!pendingChange) return;
    const newPlayer = editRoster[pendingChange.idx];
    if (type === 'sub') {
      onRosterSave(team, [...editRoster], { playerIdx: pendingChange.idx, oldPlayer: pendingChange.oldVal, newPlayer });
    } else {
      onRosterSave(team, [...editRoster]);
    }
    setPendingChange(null);
  };

  const allMatches: TeamMatchEntry[] = [];

  Object.entries(appState.matchesA).forEach(([id, data]) => {
    const [t1, t2] = id.split('-');
    if (t1 === team) allMatches.push({ stage: 'Группа A', opponent: t2, data, isTeam1: true });
    else if (t2 === team) allMatches.push({ stage: 'Группа A', opponent: t1, data, isTeam1: false });
  });
  Object.entries(appState.matchesB).forEach(([id, data]) => {
    const [t1, t2] = id.split('-');
    if (t1 === team) allMatches.push({ stage: 'Группа B', opponent: t2, data, isTeam1: true });
    else if (t2 === team) allMatches.push({ stage: 'Группа B', opponent: t1, data, isTeam1: false });
  });
  playoffMatches.forEach(({ stage, t1, t2, data }) => {
    if (t1 === team) allMatches.push({ stage, opponent: t2, data, isTeam1: true });
    else if (t2 === team) allMatches.push({ stage, opponent: t1, data, isTeam1: false });
  });

  let wins = 0, losses = 0;
  allMatches.forEach(({ data, isTeam1 }) => {
    if (!data.isFinished) return;
    const r = getMatchResult(data);
    const my = isTeam1 ? r.t1Wins : r.t2Wins;
    const opp = isTeam1 ? r.t2Wins : r.t1Wins;
    if (my > opp) wins++; else if (opp > my) losses++;
  });

  const played = allMatches.filter(m => m.data.isFinished);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-density-card border border-density-line rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-density-line shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-density-accent/20 border border-density-accent/50 rounded-lg flex items-center justify-center font-extrabold text-density-accent text-sm tracking-tight shadow-[0_0_8px_rgba(255,5,140,0.15)]">
              {team}
            </div>
            <div>
              <div className="font-extrabold text-xl tracking-tight text-white">{team}</div>
              <div className="text-[11px] text-density-text-dim uppercase tracking-widest mt-0.5">
                <span className="text-density-cyan font-bold">{wins}W</span>
                <span className="mx-1 opacity-40">—</span>
                <span className="text-red-400 font-bold">{losses}L</span>
                <span className="ml-2 opacity-50">· {played.length} матч{played.length === 1 ? '' : played.length < 5 ? 'а' : 'ей'}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-density-text-dim hover:text-white transition p-1 rounded hover:bg-white/5">
            <X size={20} />
          </button>
        </div>

        {/* Roster */}
        {roster && (
          <div className="px-5 py-3 border-b border-density-line/50 shrink-0">
            <div className="text-[10px] uppercase tracking-widest text-density-text-dim mb-2">
              Состав
              {canEdit && !pendingChange && <span className="ml-2 text-density-text-dim/40 normal-case tracking-normal">· редактируйте, затем укажите причину</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(canEdit ? editRoster : roster).map((p, idx) => {
                const isSub = teamSubs.some(c => c.playerIdx === idx);
                if (canEdit) return (
                  <input
                    key={idx}
                    type="text"
                    value={p}
                    onChange={e => { const n = [...editRoster]; n[idx] = e.target.value; setEditRoster(n); }}
                    onBlur={() => { if (p !== roster[idx] && !pendingChange) setPendingChange({ idx, oldVal: roster[idx] }); }}
                    className={`bg-density-bg border px-2 py-0.5 rounded text-[11px] text-density-text outline-none transition-colors
                      ${pendingChange?.idx === idx ? 'border-yellow-500/60' : 'border-density-line focus:border-density-accent'}`}
                    style={{ width: `${Math.max(p.length, 4) + 2}ch` }}
                  />
                );
                return (
                  <span key={idx} className={`px-2 py-0.5 rounded text-[11px] border
                    ${isSub ? 'bg-density-cyan/5 border-density-cyan/30 text-density-cyan' : 'bg-density-bg border-density-line text-density-text'}`}>
                    {p}{isSub && <span className="ml-1 text-[8px] opacity-60">↑</span>}
                  </span>
                );
              })}
            </div>

            {/* Pending change confirmation */}
            {pendingChange && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-density-text-dim">
                  <span className="line-through opacity-50">{pendingChange.oldVal}</span>
                  <span className="mx-1">→</span>
                  <span>{editRoster[pendingChange.idx]}</span>
                  <span className="mx-1 opacity-40">—</span>
                  это:
                </span>
                <button onClick={() => confirmChange('typo')}
                  className="text-[10px] px-2 py-0.5 rounded border border-density-line text-density-text-dim hover:text-white hover:border-white/30 transition">
                  Опечатка
                </button>
                <button onClick={() => confirmChange('sub')}
                  className="text-[10px] px-2 py-0.5 rounded border border-density-cyan/40 text-density-cyan hover:bg-density-cyan/10 transition">
                  Замена игрока
                </button>
                <button onClick={() => { setEditRoster([...roster]); setPendingChange(null); }}
                  className="text-[10px] px-1.5 py-0.5 rounded text-density-text-dim/50 hover:text-density-text-dim transition">
                  отмена
                </button>
              </div>
            )}

            {/* Substitution history */}
            {teamSubs.length > 0 && (
              <div className="mt-2 pt-2 border-t border-density-line/40 flex flex-col gap-1">
                <div className="text-[9px] uppercase tracking-wider text-density-text-dim/50 mb-0.5">История замен</div>
                {teamSubs.map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-density-text-dim/40 line-through">{c.oldPlayer}</span>
                    <span className="text-density-text-dim/40">→</span>
                    <span className="text-density-cyan">{c.newPlayer}</span>
                    <span className="text-density-text-dim/30 ml-auto">{new Date(c.changedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Match History */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          <div className="text-[10px] uppercase tracking-widest text-density-text-dim mb-1">История матчей</div>

          {allMatches.length === 0 && (
            <div className="text-density-text-dim text-sm text-center py-6 opacity-60">Матчи ещё не запланированы</div>
          )}

          {allMatches.map(({ stage, opponent, data, isTeam1 }, idx) => {
            const r      = getMatchResult(data);
            const myW    = isTeam1 ? r.t1Wins  : r.t2Wins;
            const oppW   = isTeam1 ? r.t2Wins  : r.t1Wins;
            const isWin  = data.isFinished && myW > oppW;
            const isLoss = data.isFinished && oppW > myW;
            const played = data.maps.filter(m => m.t1 !== '' && m.t2 !== '');
            const usedOldRoster = data.savedAt && teamSubs.some(s => new Date(data.savedAt!) < new Date(s.changedAt));

            return (
              <div
                key={idx}
                className={`rounded-lg border p-3 transition-colors
                  ${!data.isFinished ? 'bg-density-bg border-density-line opacity-60'
                    : isWin  ? 'bg-density-cyan/5 border-density-cyan/25'
                             : 'bg-red-950/30 border-red-500/30'}`}
              >
                {/* Row: badge + stage + date */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border
                      ${!data.isFinished ? 'text-density-text-dim border-density-line bg-transparent'
                        : isWin  ? 'text-density-cyan border-density-cyan/40 bg-density-cyan/10'
                                 : 'text-red-300 border-red-500/40 bg-red-500/15'}`}>
                      {!data.isFinished ? 'TBD' : isWin ? 'WIN' : 'LOSS'}
                    </span>
                    <span className="text-[10px] text-density-text-dim uppercase tracking-widest">{stage}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {usedOldRoster && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded border border-density-text-dim/20 text-density-text-dim/50">старый состав</span>
                    )}
                    {data.savedAt && (
                      <span className="text-[9px] text-density-text-dim opacity-60">
                        {new Date(data.savedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Score row */}
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-white">{team}</span>
                  <span className={`font-mono font-extrabold text-sm px-3
                    ${!data.isFinished ? 'text-density-text-dim'
                      : isWin  ? 'text-density-cyan'
                               : 'text-red-300'}`}>
                    {data.isFinished ? `${myW} : ${oppW}` : 'vs'}
                  </span>
                  <span className="font-extrabold text-sm text-white">{opponent}</span>
                </div>

                {/* Per-map scores */}
                {played.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {played.map((m, mi) => {
                      const myScore  = isTeam1 ? Number(m.t1) : Number(m.t2);
                      const oppScore = isTeam1 ? Number(m.t2) : Number(m.t1);
                      const mapWin   = myScore > oppScore;
                      return (
                        <div key={mi} className="flex items-center justify-between text-[11px] bg-black/30 rounded px-2 py-1">
                          <span className={mapWin ? 'text-density-cyan font-bold' : 'text-red-400 font-bold'}>{myScore}</span>
                          <span className="text-density-text-dim uppercase tracking-widest text-[9px] truncate px-2">{m.mapName || `Map ${mi + 1}`}</span>
                          <span className={!mapWin ? 'text-density-cyan font-bold' : 'text-red-400 font-bold'}>{oppScore}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

type Toast = { id: string; message: string; type: 'success' | 'error' };
type LogEventType = 'map' | 'series' | 'sf' | 'final' | 'third' | 'sub' | 'elim' | 'qual' | 'announce' | 'note';
type LogEntry = { id: string; timestamp: string; type: LogEventType; text: string };

function hSeed(...keys: string[]) { return keys.join('').split('').reduce((a,c)=>(a*31+c.charCodeAt(0))&0xffff,0); }
function pick(arr: string[], ...k: string[]) { return arr[hSeed(...k) % arr.length]; }
function fmtScore(r:{t1Wins:number;t2Wins:number}) { return `${Math.max(r.t1Wins,r.t2Wins)}:${Math.min(r.t1Wins,r.t2Wins)}`; }
function groupTop(matches: GroupState): string[] {
  const w: Record<string,number> = {};
  for (const id of Object.keys(matches)) { const [a,b]=id.split('-'); w[a]=w[a]??0; w[b]=w[b]??0; }
  for (const [id,d] of Object.entries(matches)) {
    if (!d.isFinished) continue;
    const [a,b]=id.split('-'); const r=getMatchResult(d);
    if (r.t1Wins>r.t2Wins) w[a]++; else w[b]++;
  }
  return Object.entries(w).sort((a,b)=>b[1]-a[1]).map(([t])=>t);
}

function applyV(t:string,v:Record<string,string>){let s=t;for(const[k,vv]of Object.entries(v))s=s.split(`{${k}}`).join(vv);return s;}

const PHR={
  gMapN:[
    'На карте {mn}: {mw} берут — {ms}.',
    '{mw} выигрывают {mn} — {ms}. Карта уходит к победителю.',
    '{mn}: победа {mw} со счётом {ms}.',
    '{mw} берут {mn} — {ms}. {ml} уступают.',
    '{mn} за {mw} — {ms}. Уверенная игра.',
  ],
  gMapC:[
    'Напряжённейший {mn}: {mw} вырывают победу — {ms}.',
    '{mn}: {ms} — {mw} берут в концовке. {ml} бились до конца.',
    '{mw} на зубах тащат {mn} — {ms}. {ml} могли взять эту карту.',
    'Какая карта! {mn} завершается {ms} в пользу {mw}.',
    '{mn}: {mw} и {ml} бьются до последнего — итог {ms}.',
  ],
  gMapD:[
    '{mw} разгромили {ml} на {mn} — {ms}. Тотальное доминирование.',
    '{mn}: {mw} без шансов для {ml} — {ms}.',
    '{ms} на {mn} — {mw} задавили {ml}. Чистый разгром.',
    'Полный контроль {mw} на {mn} — {ms}.',
    '{mn} за {mw} — {ms}. {ml} ничего не смогли сделать.',
  ],
  pfMapN:[
    '{mw} берут {mn} ({ms}) — в серии появляется перевес.',
    'На {mn}: {mw} доминируют — {ms}. Давление на {ml} нарастает.',
    'Карта {mn} уходит к {mw} — {ms}. Плей-офф накаляется.',
    '{mn}: {mw} берут своё — {ms}. Каждая карта на вес золота.',
    '{mw} выигрывают {mn} {ms}. {ml} нужна победа дальше.',
  ],
  pfMapC:[
    'Невероятный {mn}: {mw} вырывают — {ms}. В плей-офф каждый раунд золотой.',
    '{mn}: {ms} — {mw} берут в концовке. Такие карты делают легенды.',
    '{mw} на зубах берут {mn} — {ms} над {ml}. Хладнокровие решило.',
    '{mn} завершается {ms} в пользу {mw}. {ml} были в шаге от победы.',
    '{ms} на {mn} — один раунд решил всё в пользу {mw}.',
  ],
  pfMapD:[
    '{mw} сносят {ml} на {mn} — {ms}. В серии огромный перевес.',
    '{mn}: {mw} не оставляют шансов — {ms}. Разрыв в классе.',
    '{ms} на {mn} — {mw} буквально раздавили {ml}.',
    'Полный разгром на {mn}: {ms} за {mw}.',
    '{mw} катком проходят {mn} — {ms}. {ml} в растерянности.',
  ],
  grpN:[
    '{w} берут верх над {l} — {sc} по картам в группе {grp}.',
    'Группа {grp}: {w} обыгрывают {l} — {sc}. Важные очки для {w}.',
    '{w} оказались сильнее {l} — {sc}. {l} придётся собраться.',
    'Завершился матч группы {grp}: {w} побеждают {l} — {sc}.',
    '{l} уступают {w} ({sc}) в группе {grp}. {w} набирают очки.',
    'Серия завершена: {w} одолевают {l} ({sc}) в группе {grp}.',
  ],
  grpS:[
    '{w} сметают {l} — {sc}! Безоговорочная победа в группе {grp}.',
    'Сухой разгром: {w} выносят {l} {sc}. Убедительно!',
    '{w} без потери карт разобрались с {l} — {sc} в группе {grp}.',
    '{l} ничего не смогли противопоставить — {w} берут {sc}.',
    '{w} доминируют: {sc} над {l}. Группа {grp} замерла.',
  ],
  grpC:[
    '{w} вырывают серию у {l} — {sc}. Три карты, одна победа.',
    'Драматичная серия: {w} побеждают {l} {sc}. До последней карты!',
    '{l} сражались упорно, но {w} берут решающую — итог {sc}.',
    'Битва до конца: {w} vs {l} — {sc} в группе {grp}.',
    '{w} выжимают победу из серии с {l} — {sc}. Невероятно!',
  ],
  sf1:[
    'ПОЛУФИНАЛ: {w} выходят в Гранд-Финал, победив {l} — {sc}! {l} сразятся за бронзу.',
    '{w} пробиваются в финал ({sc} над {l}). Дорога к чемпионству открыта!',
    'Полуфинал позади — {w} переиграли {l} {sc}. Теперь — главный матч.',
    'Драматичный полуфинал: {w} берут верх над {l} ({sc}) и шагают в финал.',
    '{w} одерживают верх: {sc} над {l}. Один шаг до главного трофея!',
    '{w} не дают шансов {l} в полуфинале — {sc}. Финал ждёт.',
  ],
  sf2:[
    'Второй полуфинал: {w} переигрывают {l} ({sc}) и встают в очередь к финалу!',
    'ПОЛУФИНАЛ 2: {w} идут в финал — {sc} над {l}.',
    '{w} делают своё дело — {sc} над {l}. Финал {evt} обретает участника.',
    '{w} побеждают {l} ({sc}). Финал {evt} будет жарким!',
    '{w} не оставляют вопросов — {sc} против {l}. Болельщики в предвкушении финала.',
    '{w} уверенно проходят полуфинал — {sc} над {l}. Соперник по финалу найден.',
  ],
  third:[
    'Матч за третье место: {w} берут бронзу, победив {l} — {sc}.',
    '{w} не сдались после полуфинала — бронза у {l} забрана {sc}. Характер!',
    'Бронза {evt} достаётся {w}! {sc} над {l} в матче за 3-е место.',
    '{w} завершают чемпионат на пьедестале ({sc} над {l}).',
    '{w} доказали свою силу и в матче за бронзу — {sc} над {l}.',
  ],
  final:[
    'ЧЕМПИОНЫ! {w} — победители {evt}, разгромив {l} в финале — {sc}!',
    '{w} поднимают кубок {evt}, одолев {l} со счётом {sc}. Незабываемый финал!',
    'Гранд-Финал: {w} побеждают {l} {sc} и становятся чемпионами {evt}.',
    '{w} прошли весь путь — {sc} над {l} в финале. Лучшая команда {evt}!',
    '{w} — чемпионы {evt}! Финальный счёт {sc} над {l}. Этот турнир войдёт в историю!',
    '{evt} нашёл своего хозяина! {w} с результатом {sc} над {l} — легенды.',
  ],
  sub:[
    'В команде {team} замена: {old} уступает место {nw}. Посмотрим, как новый игрок впишется в схему.',
    '{team} обновляют ростер — вместо {old} в строй входит {nw}. Решение тренерского штаба.',
    'Ротация в {team}: {nw} на месте {old}. Перемены в команде держат интригу.',
    '{team} ставят на {nw}, убирая {old}. Менеджмент ищет оптимальный состав.',
    'Обновление {team}: на смену {old} — {nw}. Оправдает ли замена ожидания?',
    '{team} меняют {old} на {nw}. Командная химия должна перестроиться.',
  ],
  elim:[
    'К сожалению, {elim} покидают турнир. Команда не смогла пробиться через группу {grp}.',
    'Групповой этап завершён для {elim} — выбывают из борьбы. Три команды, только две путёвки.',
    '{elim} не удалось пробиться в плей-офф группы {grp}. Команда боролась, но этого оказалось недостаточно.',
    'Занавес опускается для {elim}. Выход в плей-офф остался мечтой.',
    '{elim} выходят из борьбы на групповом этапе. Достойное выступление, но до плей-офф дойдут другие.',
    'Прощание с {elim}: не преодолели групповой этап. Удачи в следующих турнирах!',
  ],
  qual:[
    'Группа {grp} определилась: {top1} и {top2} выходят в плей-офф!',
    'Путёвки в плей-офф из группы {grp} достаются {top1} и {top2}.',
    'Итоги группы {grp}: {top1} — 1-е место, {top2} — 2-е. Оба в полуфинале!',
    '{top1} и {top2} завершают групповой этап с путёвками из группы {grp}.',
    'Группа {grp} сделала своё дело. {top1} и {top2} движутся дальше.',
  ],
  announce:[
    'Гранд-Финал определён! {t1} против {t2} — за чемпионство {evt}!',
    'Финальная пара {evt}: {t1} vs {t2}. Болельщики в ожидании!',
    '{t1} и {t2} сразятся за кубок {evt}. Финал назначен!',
    'Всё готово к Гранд-Финалу: {t1} vs {t2}. Кто станет чемпионом?',
  ],
  thirdAnnounce:[
    'Матч за 3-е место определён: {t1} против {t2}. Борьба за бронзу {evt}!',
    '{t1} и {t2} разыграют бронзовую медаль. Поражение в полуфинале — ещё не конец.',
    'Бронзовый матч: {t1} vs {t2}. Кто уйдёт с наградой в руках?',
    'Оба проиграли в полуфинале, но {t1} и {t2} ещё поборются — за 3-е место.',
    '{t1} встретятся с {t2} в матче за бронзу. Оба хотят уйти с пьедестала не с пустыми руками.',
  ],
  open:[
    'Добро пожаловать на {evt}! Соревнования стартуют — впереди карты, нервы и эмоции. Следите за хроникой!',
    '{evt} официально открыт. Команды готовы, карты выбраны — пусть победят сильнейшие!',
    'Турнир {evt} начинается! Борьба за звание чемпиона стартует прямо сейчас.',
    'Поехали! {evt} даёт старт. Ни один матч не пройдёт мимо этой хроники.',
    'Добро пожаловать! {evt} открывает свои страницы — будет зрелищно.',
  ],
  close:[
    '{evt} завершён. Итоги пьедестала: 🥇 {first} — чемпионы, 🥈 {second} — второе место, 🥉 {third} — бронза. Спасибо всем, кто был с нами!',
    'Финальный свисток {evt}! Пьедестал: 1-е — {first}, 2-е — {second}, 3-е — {third}. Это было незабываемо.',
    '{evt} подошёл к концу. {first} забирают золото, {second} — серебро, {third} — бронзу. До встречи на следующем турнире!',
    'Вот и всё. {evt}: чемпион — {first}, вице-чемпион — {second}, бронза — {third}. Спасибо командам и болельщикам!',
  ],
};

function generateLog(
  appState: AppState,
  sf1t1:string,sf1t2:string,sf2t1:string,sf2t2:string,
  finalT1:string,finalT2:string,thirdT1:string,thirdT2:string
): LogEntry[] {
  const E: LogEntry[] = [];
  const push=(id:string,ts:string,type:LogEventType,text:string)=>E.push({id,timestamp:ts,type,text});
  const used=new Set<string>();
  const phr=(pool:string[],v:Record<string,string>,hkeys?:string[])=>{
    const base=hSeed(...(hkeys??Object.values(v)))%pool.length;
    let tmpl=pool[base];
    for(let i=1;i<pool.length;i++){if(!used.has(tmpl))break;tmpl=pool[(base+i)%pool.length];}
    used.add(tmpl);
    return applyV(tmpl,v);
  };

  const getMaps=(data:MatchData,t1:string,t2:string,id:string,pf:boolean)=>{
    const perMap=data.mapsSaved;
    data.maps.forEach((m,i)=>{
      if(m.t1===''||m.t2==='') return;
      const ts=perMap ? perMap[i] : (data.isFinished ? (data.savedAt??null) : null);
      if(!ts) return;
      const s1=Number(m.t1),s2=Number(m.t2);
      const mw=s1>s2?t1:t2,ml=s1>s2?t2:t1;
      const ms=s1>s2?`${s1}:${s2}`:`${s2}:${s1}`;
      const mn=m.mapName||`Карта ${i+1}`;
      const diff=Math.abs(s1-s2);
      const pool=pf
        ?(diff>=10?PHR.pfMapD:diff<=2?PHR.pfMapC:PHR.pfMapN)
        :(diff>=10?PHR.gMapD :diff<=2?PHR.gMapC :PHR.gMapN);
      push(`map-${id}-${i}`,ts,'map',phr(pool,{mw,ml,mn,ms}));
    });
  };

  const procGrp=(matches:GroupState,grp:string)=>{
    for(const [id,data] of Object.entries(matches)){
      getMaps(data,id.split('-')[0],id.split('-')[1],`${grp}-${id}`,false);
    }
    const sorted=Object.entries(matches)
      .filter(([,d])=>d.isFinished&&d.savedAt)
      .sort(([,a],[,b])=>a.savedAt!.localeCompare(b.savedAt!));
    for(const [id,data] of sorted){
      const [t1,t2]=id.split('-');
      const r=getMatchResult(data);  
      const [w,l]=r.t1Wins>r.t2Wins?[t1,t2]:[t2,t1];
      const sc=fmtScore(r);
      const isSweep=Math.min(r.t1Wins,r.t2Wins)===0;
      const isClose=Math.min(r.t1Wins,r.t2Wins)===1;
      const pool=isSweep?PHR.grpS:isClose?PHR.grpC:PHR.grpN;
      push(`series-${grp}-${id}`,data.savedAt,'series',phr(pool,{w,l,sc,grp}));
    }
    if(Object.values(matches).every(d=>d.isFinished&&d.savedAt)){
      const st=groupTop(matches);
      const [top1,top2,elim]=[st[0],st[1],st[2]];
      const ts=Object.values(matches).reduce((m,d)=>d.savedAt!>m?d.savedAt!:m,'');
      push(`qual-${grp}`,ts,'qual',phr(PHR.qual,{grp,top1,top2}));
      push(`elim-${grp}`,ts,'elim',phr(PHR.elim,{elim,grp}));
    }
  };

  const evt=appState.eventName??'LIDERA CUP 2026';
  const procPF=(data:MatchData,t1:string,t2:string,type:LogEventType,id:string,pool:string[])=>{
    if(t1==='TBD') return;
    getMaps(data,t1,t2,id,true);
    if(!data.isFinished||!data.savedAt) return;
    const r=getMatchResult(data);
    const [w,l]=r.t1Wins>r.t2Wins?[t1,t2]:[t2,t1];
    const sc=fmtScore(r);
    push(id,data.savedAt,type,phr(pool,{w,l,sc,evt},[w,l,sc]));
  };

  for(const c of (appState.rosterChanges||[]))
    push(`sub-${c.changedAt}`,c.changedAt,'sub',phr(PHR.sub,{team:c.team,old:c.oldPlayer,nw:c.newPlayer}));

  procGrp(appState.matchesA,'A');
  procGrp(appState.matchesB,'B');
  procPF(appState.semifinal1,sf1t1,sf1t2,'sf','sf1',PHR.sf1);
  procPF(appState.semifinal2,sf2t1,sf2t2,'sf','sf2',PHR.sf2);

  if(appState.semifinal1.isFinished&&appState.semifinal1.savedAt&&
     appState.semifinal2.isFinished&&appState.semifinal2.savedAt&&
     finalT1!=='TBD'&&finalT2!=='TBD'){
    const ts=[appState.semifinal1.savedAt,appState.semifinal2.savedAt].sort().pop()!;
    push('third-announce',ts,'announce',phr(PHR.thirdAnnounce,{t1:thirdT1,t2:thirdT2,evt},[thirdT1,thirdT2]));
    push('gf-announce',ts,'announce',phr(PHR.announce,{t1:finalT1,t2:finalT2,evt},[finalT1,finalT2]));
  }

  procPF(appState.thirdPlaceMatch,thirdT1,thirdT2,'third','third',PHR.third);
  procPF(appState.final,finalT1,finalT2,'final','final',PHR.final);

  // Opening phrase — placed 1 second before the earliest entry
  if(E.length>0){
    const firstTs=E.map(e=>e.timestamp).sort()[0];
    const openTs=new Date(new Date(firstTs).getTime()-1000).toISOString();
    push('open',openTs,'announce',phr(PHR.open,{evt},[evt]));
  }

  // Closing phrase — placed 1 second after the latest entry, when all done
  if(appState.final.isFinished&&appState.final.savedAt&&
     appState.thirdPlaceMatch.isFinished&&appState.thirdPlaceMatch.savedAt&&
     finalT1!=='TBD'&&thirdT1!=='TBD'){
    const fr=getMatchResult(appState.final);
    const first=fr.t1Wins>fr.t2Wins?finalT1:finalT2;
    const second=fr.t1Wins>fr.t2Wins?finalT2:finalT1;
    const tr=getMatchResult(appState.thirdPlaceMatch);
    const third=tr.t1Wins>tr.t2Wins?thirdT1:thirdT2;
    const lastTs=E.map(e=>e.timestamp).sort().pop()!;
    const closeTs=new Date(new Date(lastTs).getTime()+1000).toISOString();
    push('close',closeTs,'announce',phr(PHR.close,{evt,first,second,third},[first,second,third]));
  }

  const le=appState.logEdit??{hidden:[],overrides:{},custom:[]};
  return [
    ...E.filter(e=>!le.hidden.includes(e.id))
        .map(e=>le.overrides[e.id]?{...e,text:le.overrides[e.id]}:e),
    ...le.custom,
  ].sort((a,b)=>new Date(a.timestamp).getTime()-new Date(b.timestamp).getTime());
}

const ALL_LOG_TEAMS=[...TEAMS_A,...TEAMS_B];
function fmtLogText(text:string){
  const re=new RegExp(`\\b(${ALL_LOG_TEAMS.join('|')}|\\d+:\\d+)\\b`,'g');
  const parts:(string|ReactNode)[]=[];
  let last=0,m:RegExpExecArray|null;
  while((m=re.exec(text))!==null){
    if(m.index>last)parts.push(text.slice(last,m.index));
    const p=m[0];
    parts.push(ALL_LOG_TEAMS.includes(p)
      ?<span key={m.index} className="text-white font-semibold">{p}</span>
      :<span key={m.index} className="font-mono text-density-accent/75 text-[11px]">{p}</span>);
    last=m.index+p.length;
  }
  if(last<text.length)parts.push(text.slice(last));
  return parts;
}

const ChampionshipLog = ({appState,sf1t1,sf1t2,sf2t1,sf2t2,finalT1,finalT2,thirdT1,thirdT2,isExporting,canEdit,saveLogEdit}:{
  appState:AppState;sf1t1:string;sf1t2:string;sf2t1:string;sf2t2:string;
  finalT1:string;finalT2:string;thirdT1:string;thirdT2:string;
  isExporting:boolean;canEdit:boolean;saveLogEdit:(le:LogEdit)=>void;
}) => {
  const [isOpen,setIsOpen]=useState(false);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [editText,setEditText]=useState('');
  const [addingNew,setAddingNew]=useState(false);
  const [newText,setNewText]=useState('');
  const entries=generateLog(appState,sf1t1,sf1t2,sf2t1,sf2t2,finalT1,finalT2,thirdT1,thirdT2);
  if(isExporting) return null;
  const le=appState.logEdit??{hidden:[],overrides:{},custom:[]};
  const fmtDate=(iso:string)=>new Date(iso).toLocaleDateString('ru-RU',{day:'2-digit',month:'short'});
  const iconEl=(t:LogEventType)=>{
    if(t==='map')     return <Crosshair  size={10} className="text-density-text-dim/60 shrink-0"/>;
    if(t==='series')  return <Shield     size={10} className="text-density-text-dim/70 shrink-0"/>;
    if(t==='sf')      return <ArrowRight size={10} className="text-density-accent/70 shrink-0"/>;
    if(t==='final')   return <Trophy     size={10} className="text-yellow-400/90 shrink-0"/>;
    if(t==='third')   return <Award      size={10} className="text-amber-400/80 shrink-0"/>;
    if(t==='sub')     return <RotateCcw  size={10} className="text-blue-400/70 shrink-0"/>;
    if(t==='qual')    return <TrendingUp size={10} className="text-green-400/80 shrink-0"/>;
    if(t==='announce')return <Flag       size={10} className="text-density-accent/80 shrink-0"/>;
    if(t==='note')    return <Edit3      size={10} className="text-density-accent/50 shrink-0"/>;
    return                   <UserX      size={10} className="text-red-400/70 shrink-0"/>;
  };
  const deleteEntry=(id:string)=>{
    if(le.custom.some(c=>c.id===id)) saveLogEdit({...le,custom:le.custom.filter(c=>c.id!==id)});
    else saveLogEdit({...le,hidden:[...le.hidden,id]});
  };
  const saveEdit=(id:string,text:string)=>{
    if(le.custom.some(c=>c.id===id)) saveLogEdit({...le,custom:le.custom.map(c=>c.id===id?{...c,text}:c)});
    else saveLogEdit({...le,overrides:{...le.overrides,[id]:text}});
    setEditingId(null);
  };
  const addEntry=()=>{
    if(!newText.trim())return;
    const id=`note-${Date.now()}`;
    saveLogEdit({...le,custom:[...le.custom,{id,text:newText.trim(),timestamp:new Date().toISOString(),type:'note' as LogEventType}]});
    setNewText('');setAddingNew(false);
  };
  const lastEntry=entries[entries.length-1];
  const textCls=(t:LogEventType)=>
    t==='map'   ?'text-[11px] text-density-text-dim/85':
    t==='elim'  ?'text-[12px] text-red-300/80':
    t==='final' ?'text-[13px] text-white font-semibold':
    t==='announce'?'text-[12px] text-density-accent/90 font-medium':
    t==='qual'  ?'text-[12px] text-green-300/80':
    t==='note'  ?'text-[12px] text-density-text-dim italic':
                 'text-[12px] text-density-text';
  return (
    <div className="bg-density-card border border-density-line rounded-xl overflow-hidden shadow-[0_2px_24px_rgba(0,0,0,0.45)]">
      <button
        className={`w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition text-left ${isOpen?'border-b border-density-line/50':''}`}
        onClick={()=>setIsOpen(v=>!v)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <History size={12} className="text-density-text-dim/60 shrink-0"/>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-density-text-dim shrink-0">Хроника турнира</span>
          {entries.length>0&&<span className="text-[9px] px-1.5 py-0.5 rounded-full bg-density-accent/15 text-density-accent border border-density-accent/25 shrink-0 font-mono">{entries.length}</span>}
          {canEdit&&(
            <button onClick={ev=>{ev.stopPropagation();setAddingNew(v=>!v);setIsOpen(true);}} title="Добавить запись"
              className={`shrink-0 p-0.5 rounded transition-colors ${addingNew?'text-density-accent':'text-density-text-dim/35 hover:text-density-text-dim/70'}`}>
              <PlusCircle size={11}/>
            </button>
          )}
          {!isOpen&&lastEntry&&(
            <span className="hidden sm:block text-[10px] text-density-text-dim/35 italic truncate ml-1">
              {lastEntry.text.length>55?lastEntry.text.slice(0,55)+'…':lastEntry.text}
            </span>
          )}
        </div>
        <ChevronDown size={12} className={`text-density-text-dim shrink-0 ml-2 transition-transform duration-200 ${isOpen?'rotate-180':''}`}/>
      </button>
      {isOpen&&(
        <div className="relative">
          {entries.length===0&&!addingNew
            ?<div className="px-4 py-6 text-center text-density-text-dim/40 text-xs">Соревнования ещё не начались. Следите за обновлениями!</div>
            :<div className="max-h-[280px] overflow-y-auto flex flex-col [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-density-line/50 [&::-webkit-scrollbar-thumb]:rounded-full">
              {addingNew&&(
                <div className="px-4 py-2 border-b border-density-line/30">
                  <div className="flex flex-col gap-1.5">
                    <textarea value={newText} onChange={ev=>setNewText(ev.target.value)} rows={2} autoFocus
                      placeholder="Текст записи..."
                      className="w-full bg-density-bg border border-density-accent/30 rounded text-[11px] text-density-text p-1.5 resize-none outline-none focus:border-density-accent placeholder:text-density-text-dim/30"
                      onKeyDown={ev=>{if(ev.key==='Escape'){setAddingNew(false);setNewText('');}if(ev.key==='Enter'&&(ev.metaKey||ev.ctrlKey))addEntry();}}
                    />
                    <div className="flex gap-1">
                      <button onClick={addEntry} className="text-[9px] px-2 py-0.5 bg-density-accent/20 text-density-accent rounded hover:bg-density-accent/30 transition">Добавить</button>
                      <button onClick={()=>{setAddingNew(false);setNewText('');}} className="text-[9px] px-2 py-0.5 bg-white/5 text-density-text-dim rounded hover:bg-white/10 transition">Отмена</button>
                    </div>
                  </div>
                </div>
              )}
              {[...entries].reverse().map(e=>(
                <div key={e.id} className="flex items-center gap-3 px-4 py-2 border-b border-density-line/20 group hover:bg-white/[0.015] transition-colors">
                  <div className="shrink-0 w-10 text-right">
                    <span className="text-[8px] text-density-text-dim/35 uppercase leading-none">{fmtDate(e.timestamp)}</span>
                  </div>
                  <div className="w-px bg-density-line/30 shrink-0 self-stretch"/>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {iconEl(e.type)}
                    {editingId===e.id?(
                      <div className="flex-1 flex flex-col gap-1">
                        <textarea value={editText} onChange={ev=>setEditText(ev.target.value)} rows={2}
                          className="w-full bg-density-bg border border-density-accent/30 rounded text-[11px] text-density-text p-1.5 resize-none outline-none focus:border-density-accent"
                          autoFocus onKeyDown={ev=>{if(ev.key==='Escape')setEditingId(null);}}
                        />
                        <div className="flex gap-1">
                          <button onClick={()=>saveEdit(e.id,editText)} className="text-[9px] px-2 py-0.5 bg-density-accent/20 text-density-accent rounded hover:bg-density-accent/30 transition">Сохранить</button>
                          <button onClick={()=>setEditingId(null)} className="text-[9px] px-2 py-0.5 bg-white/5 text-density-text-dim rounded hover:bg-white/10 transition">Отмена</button>
                        </div>
                      </div>
                    ):(
                      <p className={`leading-snug flex-1 min-w-0 ${textCls(e.type)}`}>{fmtLogText(e.text)}</p>
                    )}
                    {canEdit&&editingId!==e.id&&(
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
                        <button onClick={()=>{setEditingId(e.id);setEditText(le.overrides[e.id]??e.text);}} title="Редактировать"
                          className="p-0.5 text-density-text-dim/30 hover:text-density-text-dim transition-colors"><Edit3 size={9}/></button>
                        <button onClick={()=>deleteEntry(e.id)} title="Удалить"
                          className="p-0.5 text-density-text-dim/30 hover:text-red-400 transition-colors"><X size={9}/></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          }
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-density-card to-transparent"/>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [appState, setAppState] = useState<AppState>(INITIAL_STATE);
  const [canEdit, setCanEdit] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [editingEventName, setEditingEventName] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef(false);

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const forceLogout = useCallback(() => {
    setCanEdit(false);
    setAuthToken(null);
    setPassword('');
    localStorage.removeItem('cs2-cup-token');
  }, []);

  // Initial state load + restore session token
  useEffect(() => {
    fetch('/api/state')
      .then(res => res.json())
      .then(data => {
        if (Object.keys(data).length > 0) setAppState(data as AppState);
      })
      .catch(() => addToast('Не удалось загрузить данные с сервера', 'error'))
      .finally(() => setIsLoading(false));

    const storedToken = localStorage.getItem('cs2-cup-token');
    if (storedToken) {
      setAuthToken(storedToken);
      setCanEdit(true);
    }
  }, [addToast]);

  // SSE: real-time updates from server
  useEffect(() => {
    let es: EventSource;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      es = new EventSource('/api/state/stream');
      es.onmessage = (e) => {
        if (pendingSave.current) return;
        try {
          const data = JSON.parse(e.data) as AppState;
          if (Object.keys(data).length > 0) setAppState(data);
        } catch {
          // ignore parse errors
        }
      };
      es.onerror = () => {
        es.close();
        retryTimer = setTimeout(connect, 5000);
      };
    };

    connect();
    return () => {
      es?.close();
      clearTimeout(retryTimer);
    };
  }, []);

  const saveState = useCallback((newState: AppState, skipDebounce = false) => {
    setAppState(newState);
    if (!canEdit || !authToken) return;

    pendingSave.current = true;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const execSave = () => {
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authToken, newState })
      })
        .then(res => {
          if (res.status === 403) {
            forceLogout();
            addToast('Сессия истекла. Войдите снова для сохранения.', 'error');
            throw new Error('session_expired');
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        })
        .catch(err => {
          if (err.message !== 'session_expired') {
            addToast('Ошибка сохранения! Данные не записаны на сервер.', 'error');
          }
        })
        .finally(() => {
          pendingSave.current = false;
        });
    };

    if (skipDebounce) execSave();
    else debounceTimer.current = setTimeout(execSave, 500);
  }, [canEdit, authToken, addToast, forceLogout]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) {
      const { token } = await res.json();
      setAuthToken(token);
      setCanEdit(true);
      setShowAuth(false);
      setPassword('');
      localStorage.setItem('cs2-cup-token', token);
    } else {
      alert('Неверный пароль');
    }
  };

  const logout = () => {
    if (authToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authToken })
      }).catch(() => {});
    }
    forceLogout();
  };

  const handleReset = async () => {
    await saveState({ ...INITIAL_STATE });
    setShowResetConfirm(false);
  };

  const handleExport = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    setTimeout(async () => {
      try {
        const dataUrl = await toPng(dashboardRef.current!, { quality: 1, backgroundColor: '#0d0e12' });
        const link = document.createElement('a');
        link.download = `cs2-cup-standings-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = dataUrl;
        link.click();
      } catch {
        addToast('Ошибка при экспорте изображения', 'error');
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  const statsA = getGroupStats(TEAMS_A, appState.matchesA);
  const statsB = getGroupStats(TEAMS_B, appState.matchesB);

  const sf1Team1 = (statsA[0].matchWins > 0 || statsA[0].mapsWon > 0) ? statsA[0].team : 'TBD';
  const sf1Team2 = (statsB[1].matchWins > 0 || statsB[1].mapsWon > 0) ? statsB[1].team : 'TBD';
  const sf2Team1 = (statsB[0].matchWins > 0 || statsB[0].mapsWon > 0) ? statsB[0].team : 'TBD';
  const sf2Team2 = (statsA[1].matchWins > 0 || statsA[1].mapsWon > 0) ? statsA[1].team : 'TBD';

  const sf1Res = getMatchResult(appState.semifinal1);
  const sf2Res = getMatchResult(appState.semifinal2);

  const finalTeam1 = sf1Res.isFinished ? (sf1Res.t1Wins > sf1Res.t2Wins ? sf1Team1 : sf1Team2) : 'TBD';
  const finalTeam2 = sf2Res.isFinished ? (sf2Res.t1Wins > sf2Res.t2Wins ? sf2Team1 : sf2Team2) : 'TBD';
  
  const thirdTeam1 = sf1Res.isFinished ? (sf1Res.t1Wins > sf1Res.t2Wins ? sf1Team2 : sf1Team1) : 'TBD';
  const thirdTeam2 = sf2Res.isFinished ? (sf2Res.t1Wins > sf2Res.t2Wins ? sf2Team2 : sf2Team1) : 'TBD';

  const finalRes = getMatchResult(appState.final);
  const finalWinner = finalRes.isFinished ? (finalRes.t1Wins > finalRes.t2Wins ? finalTeam1 : finalTeam2) : null;

  const sf1Locked   = !canEdit && (sf1Team1 === 'TBD' || sf1Team2 === 'TBD');
  const sf2Locked   = !canEdit && (sf2Team1 === 'TBD' || sf2Team2 === 'TBD');
  const finalLocked = !canEdit && (finalTeam1 === 'TBD' || finalTeam2 === 'TBD');
  const thirdLocked = !canEdit && (thirdTeam1 === 'TBD' || thirdTeam2 === 'TBD');

  const playoffMatches: PlayoffMatchInfo[] = [
    { stage: 'Полуфинал 1',    t1: sf1Team1,   t2: sf1Team2,   data: appState.semifinal1 },
    { stage: 'Полуфинал 2',    t1: sf2Team1,   t2: sf2Team2,   data: appState.semifinal2 },
    { stage: 'Гранд-финал',    t1: finalTeam1, t2: finalTeam2, data: appState.final },
    { stage: 'Матч за 3-е место', t1: thirdTeam1, t2: thirdTeam2, data: appState.thirdPlaceMatch },
  ];

  const currentRosters = { ...ROSTERS, ...appState.rosters };

  return (
    <TeamClickContext.Provider value={setSelectedTeam}>
    <RostersContext.Provider value={currentRosters}>
    <div className="min-h-screen bg-density-bg text-density-text font-sans">

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border text-sm font-medium pointer-events-auto max-w-sm animate-in slide-in-from-right-4
              ${toast.type === 'error'
                ? 'bg-red-950 border-red-500/60 text-red-200'
                : 'bg-[#001820] border-density-cyan/50 text-density-cyan'
              }`}
          >
            {toast.type === 'error'
              ? <AlertCircle size={16} className="shrink-0 text-red-400" />
              : <CheckCircle size={16} className="shrink-0 text-density-cyan" />
            }
            <span>{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="ml-2 opacity-50 hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-density-bg/90 flex items-center justify-center z-40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-density-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-density-text-dim text-sm uppercase tracking-widest">Загрузка турнира...</span>
          </div>
        </div>
      )}

      {/* Team Card Modal */}
      {selectedTeam && (
        <TeamModal
          team={selectedTeam}
          appState={appState}
          playoffMatches={playoffMatches}
          onClose={() => setSelectedTeam(null)}
          canEdit={canEdit}
          onRosterSave={(team, newRoster, sub) => {
            const newRosters = { ...ROSTERS, ...appState.rosters, [team]: newRoster };
            if (sub) {
              const change: RosterChange = { team, playerIdx: sub.playerIdx, oldPlayer: sub.oldPlayer, newPlayer: sub.newPlayer, changedAt: new Date().toISOString() };
              saveState({ ...appState, rosters: newRosters, rosterChanges: [...(appState.rosterChanges || []), change] });
            } else {
              saveState({ ...appState, rosters: newRosters });
            }
          }}
        />
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-density-card border border-density-line rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                <RotateCcw size={16} className="text-red-400" />
              </div>
              <div>
                <div className="font-semibold text-sm">Сбросить все данные?</div>
                <div className="text-xs text-density-text-dim mt-0.5">Все результаты матчей будут удалены</div>
              </div>
            </div>
            <p className="text-xs text-density-text-dim mb-5 leading-relaxed">
              Это действие сотрёт все счёта, результаты групп и плей-офф. Данные нельзя будет восстановить.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 text-xs rounded-md border border-density-line hover:bg-white/5 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2 text-xs rounded-md bg-red-500/90 hover:bg-red-500 text-white font-semibold transition"
              >
                Сбросить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleLogin} className="bg-density-card border border-density-accent p-6 rounded-lg shadow-2xl max-w-sm w-full relative">
            <button type="button" onClick={() => setShowAuth(false)} className="absolute top-4 right-4 text-density-text-dim hover:text-white"><X size={20}/></button>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Lock size={20}/> Editor Access</h2>
            <p className="text-xs text-density-text-dim mb-4">Enter the password to edit tournament results.</p>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" required className="w-full bg-density-bg border border-density-line rounded p-2 mb-4 outline-none focus:border-density-accent" />
            <button type="submit" className="w-full bg-density-accent text-white font-bold py-2 rounded hover:bg-opacity-90 transition">Login</button>
          </form>
        </div>
      )}

      {/* Main Container */}
      <div ref={dashboardRef} className="mx-auto flex flex-col w-full h-full pb-10 px-2 sm:px-4" style={isExporting ? { width: '1800px', padding: '40px' } : {}}>
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-center justify-between px-5 py-4 border-b border-density-line bg-gradient-to-r from-density-accent-dim to-transparent mb-5 gap-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="font-extrabold text-2xl tracking-tight -mb-1">
                {canEdit && editingEventName ? (
                  <input
                    autoFocus
                    type="text"
                    defaultValue={appState.eventName??'LIDERA CUP 2026'}
                    onBlur={e=>{saveState({...appState,eventName:e.target.value||'LIDERA CUP 2026'});setEditingEventName(false);}}
                    onKeyDown={e=>{if(e.key==='Enter'){e.currentTarget.blur();}if(e.key==='Escape'){setEditingEventName(false);}}}
                    className="bg-transparent border-b-2 border-density-accent outline-none text-white font-extrabold text-2xl tracking-tight w-72 uppercase"
                  />
                ) : (
                  <span
                    onClick={()=>canEdit&&setEditingEventName(true)}
                    title={canEdit?'Нажмите, чтобы изменить':undefined}
                    className={canEdit?'cursor-pointer hover:text-density-accent/80 transition-colors group relative':undefined}
                  >
                    {(()=>{const parts=(appState.eventName??'LIDERA CUP 2026').toUpperCase().split(' ');const last=parts[parts.length-1];const isYr=/^\d{4}$/.test(last);return isYr?<>{parts.slice(0,-1).join(' ')} <span className="text-density-accent">{last}</span></>:<>{parts.join(' ')}</>})()}
                    {canEdit&&<Edit3 size={11} className="inline ml-1.5 text-density-text-dim/30 group-hover:text-density-accent/50 transition-colors relative -top-0.5"/>}
                  </span>
                )}
              </div>
              <div className="text-xs text-density-text-dim uppercase tracking-widest">CS2 Championship</div>
            </div>
          </div>
          
          {!isExporting && (
            <div className="flex gap-3">
              {canEdit ? (
                <div className="flex gap-2">
                  <button onClick={() => setShowResetConfirm(true)} className="flex items-center gap-1.5 border border-red-500/40 text-red-400 px-3 py-1.5 text-xs rounded hover:bg-red-500/10 transition">
                    <RotateCcw size={13}/> Reset
                  </button>
                  <button onClick={logout} className="flex items-center gap-2 bg-density-card border border-density-line px-3 py-1.5 text-xs rounded hover:bg-white/5 transition">
                    <Save size={14}/> Editing Mode
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowAuth(true)} className="flex items-center gap-2 border border-density-line px-3 py-1.5 text-xs rounded hover:bg-white/5 transition">
                  <Edit3 size={14}/> Read-Only
                </button>
              )}
              <button onClick={handleExport} className="flex items-center gap-2 bg-density-accent text-white font-bold px-4 py-1.5 text-xs rounded hover:scale-105 transition">
                <Camera size={14}/> Export
              </button>
            </div>
          )}
        </header>

        {finalWinner && (
          <div className="text-center mb-6">
            <div className="inline-block bg-density-accent/10 border border-density-accent/50 px-8 py-3 rounded-full text-density-accent font-semibold uppercase tracking-widest text-base">
              🏆 {finalWinner} Champions 🏆
            </div>
          </div>
        )}

        <div className={`grid gap-5 w-full items-start justify-center ${isExporting ? 'grid-cols-[290px_1fr_290px]' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-[290px_1fr_290px]'}`}>
          
          {/* Group A (Left) */}
          <div className={`w-full ${isExporting ? 'order-1' : 'order-1 xl:order-1'}`}>
             <GroupWidget title="Group A" groupKey="matchesA" teams={TEAMS_A} stats={statsA} appState={appState} saveState={saveState} canEdit={canEdit} isExporting={isExporting} />
          </div>

          {/* Playoffs Bracket (Center) */}
          <div className={`w-full min-w-0 flex flex-col gap-5 ${isExporting ? 'order-2' : 'order-3 md:col-span-2 xl:col-span-1 xl:order-2'}`}>

              {/* CHAMPIONSHIP LOG */}
              <ChampionshipLog
                appState={appState}
                sf1t1={sf1Team1} sf1t2={sf1Team2}
                sf2t1={sf2Team1} sf2t2={sf2Team2}
                finalT1={finalTeam1} finalT2={finalTeam2}
                thirdT1={thirdTeam1} thirdT2={thirdTeam2}
                isExporting={isExporting}
                canEdit={canEdit}
                saveLogEdit={(le:LogEdit)=>saveState({...appState,logEdit:le})}
              />
             
              {/* GRAND FINAL WIDGET */}
             <div className="bg-density-card border border-density-accent/60 shadow-[0_0_24px_rgba(255,5,140,0.12)] rounded-xl p-5 flex flex-col items-center w-full">
                <h2 className={`text-[11px] font-semibold uppercase tracking-[0.1em] mb-5 border-b pb-3 w-full text-center transition-colors ${finalLocked ? 'text-density-text-dim/30 border-density-line/30' : 'text-density-accent border-density-accent/20'}`}>Grand Final</h2>
                <div className="transform xl:scale-[1.10] scale-105 z-20 relative origin-top max-xl:mb-2 pb-2 w-full flex justify-center">
                   <BracketNode team1={finalTeam1} team2={finalTeam2} data={appState.final} onChange={(d: MatchData) => saveState({...appState, final: d})} isFinal={true} canEdit={canEdit} isExporting={isExporting} widthClass="w-full max-w-[420px]" isLocked={finalLocked} />
                </div>
             </div>

             {/* SEMIFINALS WIDGET */}
             <div className="bg-density-card border border-density-line rounded-xl p-5 flex flex-col items-center w-full shadow-[0_2px_24px_rgba(0,0,0,0.45)]">
                 <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-density-text-dim mb-5 border-b border-density-line pb-3 w-full text-center">Semifinals</h2>
                 <div className="flex flex-col xl:flex-row w-full justify-around gap-6 xl:gap-8 pb-2 items-center">
                     <BracketNode title="Semifinal 1" team1={sf1Team1} team2={sf1Team2} data={appState.semifinal1} onChange={(d: MatchData) => saveState({...appState, semifinal1: d})} canEdit={canEdit} isExporting={isExporting} widthClass="w-full max-w-[340px]" isLocked={sf1Locked} />
                     <BracketNode title="Semifinal 2" team1={sf2Team1} team2={sf2Team2} data={appState.semifinal2} onChange={(d: MatchData) => saveState({...appState, semifinal2: d})} canEdit={canEdit} isExporting={isExporting} widthClass="w-full max-w-[340px]" isLocked={sf2Locked} />
                 </div>
             </div>

             {/* 3RD PLACE MATCH WIDGET */}
             <div className="bg-density-card border border-density-line rounded-xl p-5 flex flex-col items-center w-full shadow-[0_2px_24px_rgba(0,0,0,0.45)]">
                 <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-density-text-dim mb-5 border-b border-density-line pb-3 w-full text-center">3rd Place Match</h2>
                 <div className="pb-2 w-full flex justify-center">
                     <BracketNode team1={thirdTeam1} team2={thirdTeam2} data={appState.thirdPlaceMatch} onChange={(d: MatchData) => saveState({...appState, thirdPlaceMatch: d})} canEdit={canEdit} isExporting={isExporting} widthClass="w-full max-w-[340px]" isLocked={thirdLocked} />
                 </div>
             </div>

          </div>

          {/* Group B (Right) */}
          <div className={`w-full ${isExporting ? 'order-3' : 'order-2 xl:order-3'}`}>
             <GroupWidget title="Group B" groupKey="matchesB" teams={TEAMS_B} stats={statsB} appState={appState} saveState={saveState} canEdit={canEdit} isExporting={isExporting} />
          </div>

        </div>

      </div>
    </div>
    </RostersContext.Provider>
    </TeamClickContext.Provider>
  );
}

