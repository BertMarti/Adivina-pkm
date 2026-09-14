import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  loadSinglePlayerNationalKnowledge,
  SINGLE_PLAYER_KANTO_KNOWLEDGE,
  SINGLE_PLAYER_NATIONAL_QUESTION_BANK,
  SINGLE_PLAYER_QUESTION_BANK,
  SinglePlayerPokemonKnowledge,
} from '../data/singlePlayerKnowledge';
import {
  answerQuestion,
  createSinglePlayerGame,
  rejectWinner,
  SinglePlayerCandidate,
  SinglePlayerQuestion as EngineQuestion,
  SinglePlayerState,
} from '../game/singlePlayerEngine';
import {
  clearSinglePlayerLog,
  createSinglePlayerEventId,
  createSinglePlayerSessionId,
  exportSinglePlayerLog,
  readSinglePlayerLog,
  SINGLE_PLAYER_KNOWLEDGE_VERSION,
  SinglePlayerSessionRecord,
  upsertSinglePlayerSession,
} from '../game/singlePlayerStorage';

type SinglePlayerStep = 'pick' | 'questions' | 'guess' | 'result';
type SinglePlayerSound = 'select' | 'victory';
type EngineCandidate = SinglePlayerCandidate<number, SinglePlayerPokemonKnowledge>;

type SinglePlayerScreenProps = {
  reduceMotion: boolean;
  onBack: () => void;
  onSound: (kind: SinglePlayerSound) => void;
};

function toEngineCandidate(entry: SinglePlayerPokemonKnowledge, questionBank: readonly { trait: string }[]): EngineCandidate {
  return {
    id: entry.candidate.id,
    name: entry.candidate.name,
    answers: Object.fromEntries(questionBank.map((question) => [question.trait, entry.traits[question.trait as keyof typeof entry.traits] === true])),
    metadata: entry,
  };
}

function toEngineQuestion(question: typeof SINGLE_PLAYER_QUESTION_BANK[number]): EngineQuestion {
  return { id: question.id, trait: question.trait, text: question.prompt };
}

function makeSession(
  sessionId: string,
  selectedPokemonId: number,
  startedAt: string,
  state: SinglePlayerState<number, SinglePlayerPokemonKnowledge>,
  catalogId: string,
  knowledgeVersion: string,
  result: SinglePlayerSessionRecord['result'] = 'in-progress',
  guessedPokemonId?: number,
  rejectedGuessIds: readonly number[] = [],
): SinglePlayerSessionRecord {
  let candidatesBefore = state.candidates.length;
  const events = state.history.map((event, index) => {
    const nextEvent = {
      eventId: createSinglePlayerEventId(sessionId, index),
      questionId: event.question.id,
      question: event.question.text,
      answer: event.answer ? 'yes' as const : 'no' as const,
      candidatesBefore,
      candidatesAfter: event.remainingCount,
      remainingCandidateIds: state.candidates
        .filter((candidate) => candidate.answers[event.question.trait] === event.answer)
        .map((candidate) => candidate.id),
      recordedAt: new Date().toISOString(),
    };
    candidatesBefore = event.remainingCount;
    return nextEvent;
  });
  return {
    sessionId,
    schemaVersion: 1,
    knowledgeVersion,
    catalogId,
    startedAt,
    ...(result !== 'in-progress' ? { finishedAt: new Date().toISOString() } : {}),
    result,
    selectedPokemonId,
    ...(guessedPokemonId === undefined ? {} : { guessedPokemonId }),
    rejectedGuessIds,
    questionsAsked: events.length,
    events,
  };
}

function MiniPortrait({ pokemon, size = 62, sad = false }: { pokemon: SinglePlayerPokemonKnowledge['candidate']; size?: number; sad?: boolean }) {
  const [fallback, setFallback] = useState(false);
  const remote = sad ? pokemon.sadUrl : pokemon.portraitUrl;
  return <View pointerEvents="none" style={[soloStyles.miniPortraitFrame, { width: size, height: size }]}><Image
    accessibilityIgnoresInvertColors
    source={{ uri: fallback ? pokemon.fallbackUrl : remote }}
    onError={() => setFallback(true)}
    style={{ width: size, height: size }}
    resizeMode="contain"
  /><Text style={soloStyles.miniDexBadge}>#{String(pokemon.id).padStart(3, '0')}</Text></View>;
}

function SoloPokemonTile({ entry, onPress, disabled = false, selected = false }: { entry: SinglePlayerPokemonKnowledge; onPress: () => void; disabled?: boolean; selected?: boolean }) {
  const { width } = useWindowDimensions();
  const portraitSize = Math.max(32, Math.min(88, Math.round((Math.min(width, 720) - 42) * 0.14)));
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${entry.candidate.name}, ${selected ? 'seleccionado' : 'disponible'}`}
    accessibilityState={{ disabled, selected }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [soloStyles.tile, selected && soloStyles.tileSelected, pressed && soloStyles.tilePressed]}
  >
    <MiniPortrait pokemon={entry.candidate} size={portraitSize} />
    <Text numberOfLines={1} style={soloStyles.tileName}>{entry.candidate.name}</Text>
  </Pressable>;
}

function SoloSelection({ entries, questionCount, catalogLabel, nationalLoading, onLoadNational, onPick, onBack }: { entries: readonly SinglePlayerPokemonKnowledge[]; questionCount: number; catalogLabel: string; nationalLoading: boolean; onLoadNational: () => void; onPick: (entry: SinglePlayerPokemonKnowledge) => void; onBack: () => void }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-ES');
    if (!query) return entries;
    return entries.filter((entry) => [entry.candidate.name, ...entry.aliases].some((value) => value.toLocaleLowerCase('es-ES').includes(query)));
  }, [entries, search]);
  return <ScrollView contentContainerStyle={soloStyles.content} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" onPress={onBack} style={soloStyles.back}><Text style={soloStyles.backText}>‹ VOLVER</Text></Pressable>
    <View style={soloStyles.header}>
      <Text accessibilityRole="header" style={soloStyles.title}>MODO 1 JUGADOR</Text>
      <Text style={soloStyles.subtitle}>ELIGE UN POKÉMON EN SECRETO</Text>
      <Text style={soloStyles.body}>Después te haré preguntas que solo necesitan respuestas de SÍ o NO.</Text>
      <Text style={soloStyles.machineHint}>La máquina no ve tu elección: solo aprende de tus respuestas.</Text>
    </View>
    <TextInput
      accessibilityLabel="Buscar Pokémon"
      autoCapitalize="none"
      onChangeText={setSearch}
      placeholder="Buscar Pokémon…"
      placeholderTextColor="#777986"
      style={soloStyles.search}
      value={search}
    />
    <View style={soloStyles.catalogBadge}><Text style={soloStyles.catalogText}>BANCO {catalogLabel.toUpperCase()} · {entries.length} POKÉMON · {questionCount} PREGUNTAS</Text></View>
    {entries.length < 1025 && <Pressable accessibilityRole="button" accessibilityState={{ disabled: nationalLoading }} disabled={nationalLoading} onPress={onLoadNational} style={({ pressed }) => [soloStyles.nationalButton, pressed && soloStyles.pressed, nationalLoading && soloStyles.disabled]}><Text style={soloStyles.nationalButtonText}>{nationalLoading ? 'CARGANDO 1.025 POKÉMON…' : 'CARGAR POKÉDEX NACIONAL · 1.025'}</Text></Pressable>}
    <View style={soloStyles.grid}>{filtered.map((entry) => <SoloPokemonTile key={entry.candidate.id} entry={entry} onPress={() => onPick(entry)} />)}</View>
    {filtered.length === 0 && <Text style={soloStyles.empty}>No hay Pokémon con ese nombre.</Text>}
  </ScrollView>;
}

function QuestionActions({ onAnswer, disabled }: { onAnswer: (answer: boolean) => void; disabled: boolean }) {
  return <View style={soloStyles.answerRow}>
    <Pressable accessibilityRole="button" accessibilityLabel="Responder sí" accessibilityState={{ disabled }} disabled={disabled} onPress={() => onAnswer(true)} style={({ pressed }) => [soloStyles.answerButton, soloStyles.yesButton, pressed && soloStyles.pressed, disabled && soloStyles.disabled]}><Text style={soloStyles.answerText}>SÍ</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Responder no" accessibilityState={{ disabled }} disabled={disabled} onPress={() => onAnswer(false)} style={({ pressed }) => [soloStyles.answerButton, soloStyles.noButton, pressed && soloStyles.pressed, disabled && soloStyles.disabled]}><Text style={soloStyles.answerText}>NO</Text></Pressable>
  </View>;
}

function QuestionView({ state, onAnswer, onBack, onNewGame }: { state: SinglePlayerState<number, SinglePlayerPokemonKnowledge>; onAnswer: (answer: boolean) => void; onBack: () => void; onNewGame: () => void }) {
  const question = state.currentQuestion;
  const currentIndex = state.history.length + 1;
  return <ScrollView contentContainerStyle={soloStyles.content}>
    <Pressable accessibilityRole="button" onPress={onBack} style={soloStyles.back}><Text style={soloStyles.backText}>‹ SALIR</Text></Pressable>
    <View style={soloStyles.header}><Text accessibilityRole="header" style={soloStyles.title}>PIENSO Y ADIVINO</Text><Text style={soloStyles.subtitle}>RESPONDE SOLO SÍ O NO</Text></View>
    <View accessibilityLiveRegion="polite" style={soloStyles.progressCard}><Text style={soloStyles.progressText}>PREGUNTA {currentIndex}</Text><Text style={soloStyles.remaining}>QUEDAN {state.remainingCandidates.length} POKÉMON</Text></View>
    {!!question && <View accessibilityLiveRegion="polite" style={soloStyles.questionCard}><Text style={soloStyles.questionKicker}>MI PREGUNTA ES…</Text><Text accessibilityRole="header" style={soloStyles.questionText}>{question.text}</Text><QuestionActions onAnswer={onAnswer} disabled={false} /></View>}
    <View style={soloStyles.tipCard}><Text style={soloStyles.tipTitle}>CÓMO JUGAR</Text><Text style={soloStyles.body}>Contesta pensando en el Pokémon que acabas de elegir. Si te equivocas, podrás volver a empezar sin perder el registro.</Text></View>
    {state.history.length > 0 && <View style={soloStyles.historyCard}><Text style={soloStyles.tipTitle}>ÚLTIMA RESPUESTA</Text><Text style={soloStyles.body}>{state.history[state.history.length - 1].question.text}</Text><Text style={soloStyles.lastAnswer}>{state.history[state.history.length - 1].answer ? 'SÍ' : 'NO'} · QUEDAN {state.remainingCandidates.length}</Text></View>}
    <Pressable accessibilityRole="button" onPress={onNewGame} style={soloStyles.secondaryAction}><Text style={soloStyles.secondaryActionText}>ABANDONAR Y EMPEZAR OTRA</Text></Pressable>
  </ScrollView>;
}

function GuessView({ state, onGuessAnswer, onBack }: { state: SinglePlayerState<number, SinglePlayerPokemonKnowledge>; onGuessAnswer: (answer: boolean) => void; onBack: () => void }) {
  const winner = state.winner;
  if (!winner) return null;
  return <ScrollView contentContainerStyle={soloStyles.content}>
    <Pressable accessibilityRole="button" onPress={onBack} style={soloStyles.back}><Text style={soloStyles.backText}>‹ SALIR</Text></Pressable>
    <View style={soloStyles.header}><Text accessibilityRole="header" style={soloStyles.title}>¿LO HE ADIVINADO?</Text><Text style={soloStyles.subtitle}>RESPONDE SÍ O NO</Text></View>
    <View style={soloStyles.guessCard}><MiniPortrait pokemon={winner.metadata?.candidate ?? SINGLE_PLAYER_KANTO_KNOWLEDGE[0].candidate} size={124} /><Text style={soloStyles.guessName}>{winner.name}</Text><Text style={soloStyles.questionText}>¿Es tu Pokémon secreto?</Text><QuestionActions onAnswer={onGuessAnswer} disabled={false} /></View>
    <Text style={soloStyles.bodyCenter}>Si respondes NO, descartaré esta propuesta y seguiré con otra pregunta.</Text>
  </ScrollView>;
}

function ResultView({ state, selectedPokemonId, onNewGame, onBack }: { state: SinglePlayerState<number, SinglePlayerPokemonKnowledge>; selectedPokemonId: number; onNewGame: () => void; onBack: () => void }) {
  const title = state.phase === 'won' ? 'VICTORIA' : state.phase === 'no-match' ? 'RESPUESTAS INCOMPATIBLES' : 'NO PUEDO DECIDIRLO';
  const target = state.candidates.find((candidate) => candidate.id === selectedPokemonId)?.metadata;
  return <ScrollView contentContainerStyle={soloStyles.content}>
    <Pressable accessibilityRole="button" onPress={onBack} style={soloStyles.back}><Text style={soloStyles.backText}>‹ SALIR</Text></Pressable>
    <View style={[soloStyles.resultCard, state.phase === 'won' ? soloStyles.resultWin : soloStyles.resultOther]}>
      <Text accessibilityRole="header" style={soloStyles.resultTitle}>{title}</Text>
      {state.phase === 'won' && state.winner && <><MiniPortrait pokemon={state.winner.metadata?.candidate ?? target?.candidate ?? SINGLE_PLAYER_KANTO_KNOWLEDGE[0].candidate} size={142} /><Text style={soloStyles.resultPokemon}>{state.winner.name}</Text><Text style={soloStyles.bodyCenter}>¡He encontrado tu Pokémon!</Text><Text style={soloStyles.fact}>{(state.winner.metadata?.shortFacts ?? [state.winner.metadata?.candidate.funFact ?? '']).slice(0, 3).map((fact, index) => <Text key={`${state.winner?.id ?? 'winner'}-fact-${index}`}>{index > 0 ? '\n' : ''}{index + 1}. {fact}</Text>)}</Text></>}
      {state.phase === 'no-match' && <Text style={soloStyles.bodyCenter}>Alguna respuesta no encaja con la base de conocimiento. Puedes corregirlo empezando otra partida.</Text>}
      {state.phase === 'tie' && <><Text style={soloStyles.bodyCenter}>Estas opciones siguen siendo compatibles:</Text><Text style={soloStyles.tieNames}>{state.tiedCandidates.map((candidate) => candidate.name).join(' · ')}</Text></>}
      <Text style={soloStyles.bodyCenter}>La sesión y todas sus respuestas se han guardado en este dispositivo.</Text>
      <Pressable accessibilityRole="button" onPress={onNewGame} style={soloStyles.newGameButton}><Text style={soloStyles.newGameText}>JUGAR OTRA VEZ</Text></Pressable>
    </View>
  </ScrollView>;
}

export function SinglePlayerScreen({ reduceMotion: _reduceMotion, onBack, onSound }: SinglePlayerScreenProps) {
  const [entries, setEntries] = useState<readonly SinglePlayerPokemonKnowledge[]>(SINGLE_PLAYER_KANTO_KNOWLEDGE);
  const [catalogId, setCatalogId] = useState('kanto');
  const [catalogLabel, setCatalogLabel] = useState('Kanto');
  const [questionBank, setQuestionBank] = useState(SINGLE_PLAYER_QUESTION_BANK);
  const [nationalLoading, setNationalLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [step, setStep] = useState<SinglePlayerStep>('pick');
  const [state, setState] = useState<SinglePlayerState<number, SinglePlayerPokemonKnowledge> | null>(null);
  const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(null);
  const [rejectedGuessIds, setRejectedGuessIds] = useState<number[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const sessionRef = useRef<{ id: string; startedAt: string; catalogId: string; knowledgeVersion: string } | null>(null);

  useEffect(() => {
    void readSinglePlayerLog().then((sessions) => setSessionCount(sessions.length));
    void AccessibilityInfo.announceForAccessibility?.('Modo 1 jugador preparado');
  }, []);

  const persist = (nextState: SinglePlayerState<number, SinglePlayerPokemonKnowledge>, result: SinglePlayerSessionRecord['result'] = 'in-progress', guessedPokemonId?: number, nextRejectedGuessIds = rejectedGuessIds) => {
    const session = sessionRef.current;
    const selected = selectedPokemonId;
    if (!session || selected === null) return;
    void upsertSinglePlayerSession(makeSession(session.id, selected, session.startedAt, nextState, session.catalogId, session.knowledgeVersion, result, guessedPokemonId, nextRejectedGuessIds)).then((saved) => {
      if (saved) setSessionCount((count) => Math.max(count, 1));
    });
  };

  const loadNational = async () => {
    if (nationalLoading) return;
    setCatalogError('');
    setNationalLoading(true);
    try {
      const national = await loadSinglePlayerNationalKnowledge();
      setEntries(national);
      setCatalogId('national');
      setCatalogLabel('Pokédex Nacional');
      setQuestionBank(SINGLE_PLAYER_NATIONAL_QUESTION_BANK);
    } catch (cause) {
      setCatalogError(cause instanceof Error ? cause.message : 'No se pudo cargar la Pokédex Nacional.');
    } finally {
      setNationalLoading(false);
    }
  };

  const startGame = (entry: SinglePlayerPokemonKnowledge) => {
    const questions = questionBank.map(toEngineQuestion);
    const nextState = createSinglePlayerGame(entries.map((entry) => toEngineCandidate(entry, questionBank)), { questions });
    setSelectedPokemonId(entry.candidate.id);
    sessionRef.current = { id: createSinglePlayerSessionId(), startedAt: new Date().toISOString(), catalogId, knowledgeVersion: catalogId === 'national' ? 'national-1025-v1' : SINGLE_PLAYER_KNOWLEDGE_VERSION };
    setRejectedGuessIds([]);
    setState(nextState);
    setStep('questions');
    onSound('select');
  };

  const answer = (value: boolean) => {
    if (!state || state.phase !== 'playing') return;
    const nextState = answerQuestion(state, value);
    setState(nextState);
    persist(nextState);
    if (nextState.phase === 'won') setStep('guess');
    else if (nextState.phase === 'tie' || nextState.phase === 'no-match') setStep('result');
  };

  const answerGuess = (correct: boolean) => {
    if (!state || !state.winner) return;
    if (correct) {
      setStep('result');
      onSound('victory');
      persist(state, 'won', state.winner.id);
      return;
    }
    const nextRejected = [...rejectedGuessIds, state.winner.id];
    const nextState = rejectWinner(state);
    setRejectedGuessIds(nextRejected);
    setState(nextState);
    persist(nextState, nextState.phase === 'no-match' ? 'inconsistent' : 'in-progress', undefined, nextRejected);
    setStep(nextState.phase === 'playing' ? 'questions' : 'result');
  };

  const newGame = () => {
    if (state && sessionRef.current && step !== 'result') persist(state, 'abandoned');
    setState(null);
    setSelectedPokemonId(null);
    setRejectedGuessIds([]);
    sessionRef.current = null;
    setStep('pick');
  };

  const back = () => {
    if (step === 'pick') onBack();
    else newGame();
  };

  const exportLog = async () => {
    const content = JSON.stringify(await exportSinglePlayerLog(), null, 2);
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(content);
      return;
    }
    await Share.share({ message: content });
  };

  const clearLog = async () => {
    await clearSinglePlayerLog();
    setSessionCount(0);
  };

  return <View style={soloStyles.root}>
    {step === 'pick' && <SoloSelection entries={entries} questionCount={questionBank.length} catalogLabel={catalogLabel} nationalLoading={nationalLoading} onLoadNational={() => void loadNational()} onPick={startGame} onBack={onBack} />}
    {!!catalogError && step === 'pick' && <Text accessibilityRole="alert" style={soloStyles.error}>{catalogError}</Text>}
    {step === 'questions' && state && <QuestionView state={state} onAnswer={answer} onBack={back} onNewGame={newGame} />}
    {step === 'guess' && state && <GuessView state={state} onGuessAnswer={answerGuess} onBack={back} />}
    {step === 'result' && state && selectedPokemonId !== null && <ResultView state={state} selectedPokemonId={selectedPokemonId} onNewGame={newGame} onBack={onBack} />}
    {step === 'pick' && <View style={soloStyles.historyFooter}><Text style={soloStyles.historyTitle}>HISTORIAL LOCAL: {sessionCount}</Text><View style={soloStyles.historyActions}><Pressable accessibilityRole="button" onPress={() => void exportLog()} style={soloStyles.smallAction}><Text style={soloStyles.smallActionText}>COPIAR JSON</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void clearLog()} style={soloStyles.smallAction}><Text style={soloStyles.smallActionText}>BORRAR</Text></Pressable></View><Text style={soloStyles.historyHint}>Se guardan preguntas, respuestas, candidatos restantes y resultados. Sin servidor.</Text></View>}
  </View>;
}

const soloStyles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingTop: 22, paddingBottom: 54, gap: 15 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: 18 },
  backText: { color: '#FFD000', fontFamily: 'PressStart2P_400Regular', fontSize: 9, letterSpacing: 0.8 },
  header: { alignItems: 'center', gap: 8, paddingVertical: 6 },
  title: { color: '#FFD000', fontFamily: 'PressStart2P_400Regular', fontSize: 18, lineHeight: 27, textAlign: 'center', textShadowColor: '#453A00', textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
  subtitle: { color: '#38D37D', fontFamily: 'PressStart2P_400Regular', fontSize: 8, textAlign: 'center', letterSpacing: 0.6 },
  body: { color: '#F6F5EF', fontSize: 13, lineHeight: 20 },
  machineHint: { color: '#9FE7B8', backgroundColor: 'rgba(24, 81, 58, 0.56)', borderRadius: 7, padding: 10, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  bodyCenter: { color: '#F6F5EF', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  search: { minHeight: 52, borderRadius: 8, borderWidth: 2, borderColor: '#67686F', backgroundColor: '#101116', color: '#F6F5EF', paddingHorizontal: 14, fontSize: 15 },
  catalogBadge: { backgroundColor: 'rgba(5, 11, 24, 0.9)', borderRadius: 8, borderWidth: 2, borderColor: '#4B4B4F', padding: 11 },
  catalogText: { color: '#FFD000', fontFamily: 'PressStart2P_400Regular', fontSize: 7, lineHeight: 13, textAlign: 'center' },
  nationalButton: { minHeight: 48, borderRadius: 8, borderWidth: 2, borderColor: '#79A2FF', backgroundColor: '#4059D2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  nationalButtonText: { color: '#111128', fontFamily: 'PressStart2P_400Regular', fontSize: 8, lineHeight: 14, textAlign: 'center' },
  error: { color: '#F6F5EF', backgroundColor: '#8D394F', borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 7, backgroundColor: 'rgba(0, 0, 0, 0.68)', borderRadius: 10, borderWidth: 3, borderColor: '#292B33', padding: 8 },
  tile: { width: '18.4%', aspectRatio: 0.9, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 1, backgroundColor: '#FFF3D2', borderRadius: 7, borderWidth: 3, borderColor: '#454650', paddingHorizontal: 1, overflow: 'hidden' },
  tileSelected: { borderColor: '#FFD000', backgroundColor: '#FFE68C' },
  tilePressed: { transform: [{ scale: 0.96 }], opacity: 0.88 },
  tileName: { color: '#111128', fontSize: 6, fontWeight: '900', textAlign: 'center', maxWidth: '100%' },
  empty: { color: '#F6F5EF', textAlign: 'center', padding: 20 },
  progressCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(5, 11, 24, 0.94)', borderRadius: 8, borderWidth: 2, borderColor: '#4B4B4F', padding: 13 },
  progressText: { color: '#38D37D', fontFamily: 'PressStart2P_400Regular', fontSize: 8 },
  remaining: { color: '#FFD000', fontFamily: 'PressStart2P_400Regular', fontSize: 7 },
  questionCard: { backgroundColor: 'rgba(29, 30, 42, 0.97)', borderRadius: 14, borderWidth: 3, borderColor: '#FFD000', padding: 17, gap: 14, alignItems: 'center', shadowColor: '#FFD000', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  questionKicker: { color: '#F06B00', fontFamily: 'PressStart2P_400Regular', fontSize: 8 },
  questionText: { color: '#F6F5EF', fontSize: 22, fontWeight: '900', lineHeight: 31, textAlign: 'center' },
  answerRow: { flexDirection: 'row', width: '100%', gap: 10, marginTop: 4 },
  answerButton: { flex: 1, minHeight: 62, borderRadius: 9, borderWidth: 3, borderBottomWidth: 6, alignItems: 'center', justifyContent: 'center' },
  yesButton: { backgroundColor: '#226B45', borderColor: '#7BEEA8', borderBottomColor: '#123D29' },
  noButton: { backgroundColor: '#8D394F', borderColor: '#FF9AA0', borderBottomColor: '#4F1E2B' },
  answerText: { color: '#F6F5EF', fontFamily: 'PressStart2P_400Regular', fontSize: 14 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.86 },
  disabled: { opacity: 0.45 },
  tipCard: { backgroundColor: 'rgba(29, 30, 42, 0.92)', borderRadius: 9, padding: 13, gap: 6 },
  tipTitle: { color: '#FFD000', fontFamily: 'PressStart2P_400Regular', fontSize: 8, lineHeight: 14 },
  historyCard: { backgroundColor: 'rgba(29, 30, 42, 0.92)', borderRadius: 9, borderLeftWidth: 4, borderLeftColor: '#4C6BE8', padding: 13, gap: 7 },
  lastAnswer: { color: '#38D37D', fontFamily: 'PressStart2P_400Regular', fontSize: 8 },
  secondaryAction: { minHeight: 48, borderRadius: 7, borderWidth: 2, borderColor: '#645B96', backgroundColor: 'rgba(17, 18, 24, 0.75)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryActionText: { color: '#C7C5FF', fontFamily: 'PressStart2P_400Regular', fontSize: 7, textAlign: 'center' },
  guessCard: { alignItems: 'center', gap: 12, backgroundColor: '#FFF3D2', borderRadius: 12, borderWidth: 3, borderColor: '#FFD000', padding: 16 },
  guessName: { color: '#111128', fontFamily: 'PressStart2P_400Regular', fontSize: 13 },
  resultCard: { alignItems: 'center', gap: 12, borderRadius: 13, borderWidth: 3, padding: 18 },
  resultWin: { backgroundColor: 'rgba(24, 81, 58, 0.96)', borderColor: '#38D37D' },
  resultOther: { backgroundColor: 'rgba(29, 30, 42, 0.97)', borderColor: '#FFD000' },
  resultTitle: { color: '#FFD000', fontFamily: 'PressStart2P_400Regular', fontSize: 19, textAlign: 'center', lineHeight: 28 },
  resultPokemon: { color: '#FFD000', fontFamily: 'PressStart2P_400Regular', fontSize: 13, textAlign: 'center' },
  fact: { color: '#F6F5EF', backgroundColor: 'rgba(0, 0, 0, 0.23)', borderRadius: 8, padding: 12, textAlign: 'center', fontSize: 12, lineHeight: 18 },
  miniPortraitFrame: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  miniDexBadge: { position: 'absolute', right: 0, bottom: 0, color: '#F6F5EF', backgroundColor: 'rgba(5, 7, 11, 0.84)', fontFamily: 'PressStart2P_400Regular', fontSize: 6, lineHeight: 9, paddingHorizontal: 2, borderRadius: 2 },
  tieNames: { color: '#FFD000', fontFamily: 'PressStart2P_400Regular', fontSize: 8, lineHeight: 15, textAlign: 'center' },
  newGameButton: { minHeight: 54, borderRadius: 8, borderWidth: 2, borderBottomWidth: 5, borderColor: '#79A2FF', borderBottomColor: '#283B9D', backgroundColor: '#4059D2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, width: '100%' },
  newGameText: { color: '#111128', fontFamily: 'PressStart2P_400Regular', fontSize: 9, textAlign: 'center' },
  historyFooter: { borderTopWidth: 2, borderTopColor: '#4B4B4F', margin: 16, paddingTop: 13, gap: 8 },
  historyTitle: { color: '#FFD000', fontFamily: 'PressStart2P_400Regular', fontSize: 8, textAlign: 'center' },
  historyActions: { flexDirection: 'row', gap: 8 },
  smallAction: { flex: 1, minHeight: 44, borderRadius: 7, borderWidth: 2, borderColor: '#67686F', backgroundColor: '#171820', alignItems: 'center', justifyContent: 'center' },
  smallActionText: { color: '#F6F5EF', fontFamily: 'PressStart2P_400Regular', fontSize: 7 },
  historyHint: { color: '#A7A8B2', fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
