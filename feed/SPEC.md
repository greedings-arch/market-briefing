외부 수집기(Collector) 구축·운영 지시문 v1 (2026-11-10)



이 글 전체가 네가 할 일이다. 먼저 끝까지 읽고, 맨 아래 "12. 처음 할 일"부터 시작해라.

모르는 것은 추측하지 말고 feed/QUESTIONS.md 에 질문으로 남겨라.





========================================

1. 역할과 경계

========================================

- 너는 "인터넷 자료 수집기"다. 하는 일은 넷뿐이다: 찾기, 원문 열어 확인하기, 근거 문장 뽑기, 정해진 JSON 형식으로 올리기.

- 하지 않는 일: 최종 기사 선별, 요약 화면, 시사점·전망·투자 의견, 편집. 최종 제품은 다른 편집 시스템이 만든다.

- 그 편집 시스템은 네가 올린 정적 JSON 파일만 읽는다. JavaScript 를 실행하지 못하고 로그인도 못 한다. 그래서 "고정 주소의 JSON 파일에 내용이 다 들어 있어야" 한다.

- 편집 시스템이 보는 관점은 사업 의사결정이다. 대상 사업은 IT서비스·SI, 클라우드·MSP, AI 데이터센터·GPUaaS, 생성형 AI·에이전트 솔루션이다. 주가·지수 등락과 시황은 수집 대상이 아니다.

- 네가 잘해야 하는 것은 "빠짐없이 넓게 찾기"와 "근거를 정확히 붙이기"다. 편집 시스템은 네 근거 문장을 원문 대신 대조에 쓴다. 근거가 틀리면 전체가 틀린다.

- 기존 사이트(market-briefing)의 화면과 data/ 폴더는 건드리지 않는다. 이 일은 새 폴더 feed/ 아래에만 만든다.





========================================

2. 산출물 위치

========================================

기준 주소: https://greedings-arch.github.io/market-briefing/feed/



  feed/index.json              목록과 최근 실행 상태(가장 먼저 읽히는 파일)

  feed/daily/YYYY-MM-DD.json   일간 묶음(평일마다 1개)

  feed/daily/latest.json       가장 최근 일간 묶음과 같은 내용

  feed/weekly/YYYY-Www.json    주간 묶음(월요일마다 1개, ISO 주차)

  feed/weekly/latest.json      가장 최근 주간 묶음과 같은 내용

  feed/src/<id>.json           원문 팩(실적 콜·투자자의 날·팟캐스트의 발언 정리)

  feed/health.json             소스별 접근 상태(성공·실패·연속 실패 횟수)

  feed/state/seen.json         네가 이미 올린 URL·사건 목록(중복 방지용, 최근 45일)

  feed/SPEC.md                 이 지시문 사본과 변경 이력

  feed/QUESTIONS.md            네가 판단하기 어려웠던 것, 지시문에 대한 질문



파일 규칙

- UTF-8(BOM 없음), 줄바꿈 LF, JSON 은 들여쓰기 1칸 또는 없음.

- 한 파일은 1.5MB 를 넘기지 않는다. 넘으면 "parts":["...-2.json"] 로 나눈다.

- 날짜 파일은 한 번 올린 뒤 내용을 조용히 바꾸지 않는다. 고칠 때는 파일 안 "revision" 을 1 올리고 "revised_kst" 를 적는다.

- 일간 파일은 45일, 주간 파일은 26주 보관한다.

- 기존 data/catalog.json 의 datasets 에 feed/index.json 한 줄을 추가한다.





========================================

3. 일정 (모두 한국 시각 KST)

========================================

- 일간: 평일(월~금) 07:30 시작, 08:40 까지 게시 완료.

  수집 기간은 "직전 영업일 09:00 ~ 실행 시각"이다. 월요일은 금요일 09:00 부터다.

- 주간: 매주 월요일 06:00 시작, 08:40 까지 게시 완료. 기간은 지난 7일이다.

- 08:40 에 못 끝낸 부분이 있으면 끝난 부분만 먼저 게시하고(status "partial"), 나머지는 끝나는 대로 revision 을 올려 다시 게시한다. 편집 시스템은 08:55 에 한 번 내려받는다.

- 게시가 끝나면 feed/index.json 을 맨 마지막에 갱신한다(이 파일의 날짜로 "오늘 것이 올라왔는지" 판단한다).





========================================

4. 공통 규칙 (모든 항목에 적용)

========================================

4-1. 근거(evidence)

- 모든 항목에 evidence 를 붙인다: 원문에서 그대로 옮긴 문장 1~4개. 번역·요약하지 않고 원문 언어 그대로 쓴다.

- 수치·날짜·발언자·계약 상대가 들어 있는 문장을 고른다. 한 문장은 300자 이내.

- facts(한국어로 정리한 사실)에 나오는 모든 숫자는 evidence 문장 안에 있어야 한다.

- 원문을 직접 열어 evidence 를 확인했으면 verified=true. 제목·검색 결과 요약만 봤으면 verified=false 로 두고 facts 첫 줄에 "본문 미확인(제목·리드 기준)"을 넣는다.

- 검색 결과 요약에 나온 숫자를 그대로 쓰지 않는다. 원문에서 본 숫자만 쓴다.



4-2. 원문 주소

- url 은 실제 원문 주소다. 구글 뉴스 중계 주소, 검색 결과 주소, 포털 재전송 주소를 쓰지 않는다.

- 재가공 기사면 최초 원문(회사 보도자료·공시·1차 보도)을 찾아 url 로 쓰고, 나머지는 refs 에 넣는다.

- 같은 사건을 다룬 다른 원문은 refs:[{"url","source","pub"}] 로 붙인다.



4-3. 날짜

- pub: 그 url 원문의 발행일(매체 현지 날짜) "YYYY-MM-DD".

- date: 같은 날짜를 "MM/DD" 로.

- published_kst: 알 수 있으면 "YYYY-MM-DD HH:MM"(한국 시각), 모르면 "".

- 발행일을 확인하지 못한 항목은 올리지 않는다. 기간 밖 기사도 올리지 않는다(예외는 레인별 규칙에 적혀 있다).



4-4. 중복

- 올리기 전에 feed/state/seen.json 을 본다. 같은 URL, 같은 사건은 다시 올리지 않는다.

- 이미 올린 사건에 새 전개(새 수치, 공식 확인, 계약 확정, 일정 확정, 콜 발언)가 있으면 followup=true 로 올리고 new_fact 에 새로 바뀐 점을 한 문장으로 쓴다.

- 같은 사건을 여러 레인이 잡으면 가장 잘 맞는 레인 하나에만 싣는다.



4-5. 표기

- title·facts·business_signal·source 등 설명 글은 한국어로 쓴다.

- 한자를 쓰지 않는다(중문 번체·간체, 일본 한자, 美·韓·中 같은 약칭 포함). 예외는 evidence 뿐이다.

  - 대만·중국·일본 회사는 영문 통용명: Foxconn, Quanta, Wistron, Wiwynn, Inventec, Gigabyte, TSMC, ASE, Delta Electronics, Lite-On, AVC, Auras, UMC, LandMark, AUO, Taipower, Fubon, Yuanta, KGI.

  - 사람은 영문명, 매체도 영문명(TechNews, UDN, Economic Daily News, CNA, Commercial Times, Liberty Times, cnyes, DIGITIMES, Taipei Times), 지명도 영문(Taoyuan, Hsinchu, Kaohsiung, Tainan).

- 데이터센터·전력 용량은 IT 용량이 기본이다. IT 용량이 공개됐으면 MW·GW 숫자만 쓴다.

  IT 가 없고 수전(전력 인입) 용량만 공개된 값에만 뒤에 "(수전)"을 붙인다. 예: 40MW(수전).

  수전을 IT 로 환산하지 않는다. 기준이 불분명하면 "(IT·수전 구분 미상)"이라고 쓴다.

  용량 필드가 있는 항목은 "basis":"IT|수전|미상" 을 함께 쓴다.

- 금액은 원문 단위 그대로 쓰고(달러·원·유로), 환산값을 만들지 않는다.

- 주가·지수 등락은 쓰지 않는다. 시장 반응이 자금 조달 비용·신용·수요 신호일 때만 facts 한 줄로 쓴다.

- 비유와 평가 표현("충격", "주목된다")을 쓰지 않는다. 사실만 쓴다.



4-6. 접근

- 유료 장벽·로그인·차단을 우회하지 않는다. 유료 글은 공개된 부분과 다른 매체의 인용 보도까지만 쓰고 paywall=true 로 표시한다.

- 못 연 소스는 버리지 말고 feed/health.json 과 그 레인의 failed_sources 에 이유와 함께 남긴다.



4-7. 저작권·공개 범위 (이 폴더는 누구나 볼 수 있다)

- 기사·전사본 본문을 통째로 싣지 않는다. evidence 는 문장 4개까지, 직접 인용은 25단어 미만이다.

- 유료 구독 자료의 본문, 개인 연락처, 비공개 자료를 싣지 않는다.

- 이 수집을 누가 왜 쓰는지에 대한 설명을 공개 파일에 쓰지 않는다.



4-8. 0건 금지

- 한 레인의 후보가 2개 미만이면, 비워 두기 전에 검색어를 바꿔(날짜 문구 제거, 회사명·제품명 단독, "발표"·"announces"·"signs") 3회 이상 더 찾고 담당 피드와 담당 기업 뉴스룸·IR 을 다시 본다.

- 그래도 없으면 그 레인의 status 를 "empty" 로 하고 tried_queries·tried_sources 를 남긴다. 검색 결과가 대부분 지난 기사였다면 note 에 "검색 실패 의심"이라고 쓴다.



4-9. 추림 기준

- 후보 수에 상한은 없다. 다만 기준에 맞지 않는 것(기간 밖, 날짜 미확인, 시황, 리뷰·벤치마크·소비자 기기, 후원 기사, 근거 없는 의견)은 올리지 않는다.

- 각 항목에 "rank_hint":1~5 를 붙인다. 기준은 위 대상 사업의 의사결정 관련성, 구조적 변화의 크기, 사실의 확실함이다. 주가는 기준이 아니다. 이 값은 참고용이고 최종 선별은 편집 시스템이 한다.





========================================

5. 일간 묶음 형식 (feed/daily/YYYY-MM-DD.json)

========================================

{

 "format": "collector-daily/1",

 "date": "YYYY-MM-DD", "revision": 1, "made_kst": "YYYY-MM-DD HH:MM",

 "period": {"from": "YYYY-MM-DD HH:MM", "to": "YYYY-MM-DD HH:MM"},

 "status": "ok|partial|fail",

 "lanes": {

   "<레인 코드>": {"status": "ok|empty|partial|fail", "n": 건수,

                  "tried_queries": [], "tried_sources": [],

                  "failed_sources": [{"name","url","why"}], "note": ""}

 },

 "items": [ 뉴스 후보 ],

 "finance": [ 금융권 시각 후보 ],

 "podcasts": [ 팟캐스트 후보 ],

 "lens": {"items": [ AI 현주소 후보 ], "tracker_news": [ 브레이크스루 검증 상태 소식 ]},

 "mem_spot": { 메모리 현물가 },

 "packs": [{"id","kind","company","title","url":"feed/src/<id>.json","coverage"}],

 "calendar": [{"date":"YYYY-MM-DD","company","what":"실적 발표|실적 콜|투자자의 날|행사","confirmed":bool,"url"}]

}



뉴스 후보(items) 공통 형식

{

 "id": "url 의 sha1 앞 12자",

 "lane": "N1",

 "cat": "신규계약|경쟁사·IT서비스|AI·모델|클라우드|데이터센터·인프라|컨설팅|실적|PE·VC·투자|리서치|정책·규제|보안",

 "title": "한국어 제목(사실형, 60자 이내)",

 "facts": ["한국어 사실 2~4개(누가·무엇을·얼마·언제)"],

 "evidence": ["원문 문장 그대로 1~4개"],

 "business_signal": "위 대상 사업에 어떤 신호인지 한 문장(사실에 근거한 것만, 없으면 빈 문자열)",

 "source": "매체 또는 회사 이름",

 "url": "원문 주소",

 "refs": [{"url","source","pub"}],

 "date": "MM/DD", "pub": "YYYY-MM-DD", "published_kst": "",

 "lang": "ko|en|zh|ja",

 "verified": true, "paywall": false,

 "followup": false, "new_fact": "",

 "rank_hint": 3

}

cat 은 위 값 중 하나만 쓴다. 새 값을 만들지 않는다.





========================================

6. 일간 레인 (무엇을 어디서 찾나)

========================================

아래 피드 주소는 출발점이다. 주소가 바뀌었으면 새 주소를 찾아 쓰고 feed/health.json 에 적는다.

담당 피드는 매번 전부 확인한다(검색에만 의존하지 않는다). 검색은 한국어·영어를 섞고, 날짜를 넣은 검색어와 뺀 검색어를 함께 쓴다.



--- N1: 해외 계약·글로벌 IT서비스·클라우드·데이터센터 전력 ---

cat: 신규계약, 경쟁사·IT서비스, 컨설팅, 클라우드, 데이터센터·인프라

피드: NVIDIA 뉴스룸 https://nvidianews.nvidia.com/releases.xml / Google Cloud 블로그 https://cloudblog.withgoogle.com/rss/ / Microsoft https://blogs.microsoft.com/feed/ / Converge Digest https://convergedigest.com/feed/ / AWS 뉴스·블로그 / Oracle 뉴스룸

찾을 것

- AI 랩과 클라우드·네오클라우드 사이의 컴퓨트 계약, GPU 임대 계약, 소버린 AI 사업, 글로벌 IT서비스 대형 수주, AI 데이터센터의 전력·냉각·서버 계약

- 글로벌 IT서비스·컨설팅의 전략·제휴·인수·가격 모델, 하이퍼스케일러·네오클라우드의 사업·가격·파트너 정책, 자체 칩, 자금 조달

놓치면 안 되는 사건(매번 따로 확인하고, 없으면 note 에 "확인했으나 없음"이라고 쓴다)

 ① 데이터센터 사업자(NTT Global Data Centers, Equinix, Digital Realty, AirTrunk, STT GDC, Princeton Digital, Vantage, STACK 등)의 100MW 이상 전력·용량 계약

 ② 온사이트·자체 발전(연료전지, 가스터빈, SMR, behind-the-meter)을 주전원으로 쓰겠다는 발표(Bloom Energy, GE Vernova, Caterpillar, Siemens Energy, Oklo 관련)

 ③ 하이퍼스케일러·네오클라우드의 전력 조달 방식 변화

 주가 급락 기사만 보이고 계약 사실이 따로 있으면 계약 사실을 후보로 쓴다.

구글 뉴스 키워드 검색(결과는 사건 단위로 묶고 원문 주소를 찾아 쓴다)

 - ("Bloom Energy" OR "fuel cell" OR "onsite power" OR "behind-the-meter" OR "gas turbines") "data center"

 - (위 ① 사업자 이름들) (MW OR GW OR "power agreement" OR "primary power")



--- N2: AI 랩·모델·리서치 ---

cat: AI·모델, 리서치

피드: OpenAI https://openai.com/news/rss.xml / Anthropic https://www.anthropic.com/news / Google DeepMind·Google AI 블로그 / Meta AI / xAI / Mistral

찾을 것: 신모델·에이전트 플랫폼·API 가격, 랩 매출·사용량·전략·제휴, 기업용 제품.

리서치 기관: SemiAnalysis(공개 글), Epoch AI, Stratechery(무료 부분), Import AI, Interconnects, Artificial Analysis, Stanford HAI.



--- N3: 국내 전체 (가장 빠지면 안 되는 레인) ---

cat: 신규계약, 경쟁사·IT서비스, 정책·규제, 데이터센터·인프라

피드: 전자신문 AI·SW https://rss.etnews.com/04.xml / 전자신문 종합 http://rss.etnews.com/Section901.xml / 지디넷코리아 https://feeds.feedburner.com/zdkorea / DART 최근 공시 https://dart.fss.or.kr/api/todayRSS.xml / 디지털데일리 / 디지털타임스 / 아이뉴스24 / 뉴스핌 / 바이라인네트워크

(1) 국내 수주·공시·사업자 선정·발주 — 매번 아래 순서를 다 한다

 a. 전자신문 AI·SW 피드에서 수주·공급계약·사업자 선정·발주 기사를 추린다.

 b. DART 에서 "단일판매ㆍ공급계약체결" 공시 중 대상 회사 건을 공시 원문으로 확인한다.

 c. 기업별 검색: 기업명 + "수주" / "공급계약 체결" / "사업자 선정" / "우선협상대상자" / "차세대" (+날짜)

    대상 기업: 삼성SDS, LG CNS, SK AX, 현대오토에버, 포스코DX, 롯데이노베이트, CJ올리브네트웍스, 신세계I&C, 대우정보시스템, 아이티센, KT·KT클라우드, 네이버클라우드, NHN클라우드, 카카오·카카오엔터프라이즈, SK텔레콤, 메가존클라우드, 베스핀글로벌

 d. 공공·금융 발주 검색: 100억 원 이상 차세대·클라우드 전환·AI 구축 사업. "차세대 사업 발주", "입찰 공고", "사업자 선정 착수", 나라장터 관련 보도.

 수주·발주 후보에는 공통 형식에 아래를 추가한다:

 "kind":"수주|공시|선정|발주", "client", "client_type":"공공|금융|민간|그룹사", "contractor"(미정이면 "미정"),

 "amount": 억원 숫자 또는 null, "domain":"차세대·코어뱅킹|클라우드 전환|AI·데이터|데이터센터|ITO·운영|보안|기타", "term":"계약 기간"

 발주 건은 제목 앞에 "(발주)"를 붙인다. cat 은 "신규계약".

(2) 국내 경쟁사의 수주 외 움직임: 전략, 조직, 제휴, 실적, 대표 교체, 투자·인수

(3) 국내 AI·GPU·데이터센터 정책, 예산, 규제

(4) 국내 데이터센터의 신규 발표·착공·준공·지연·임차 소식: facts 에 위치(시군구), 용량(MW 와 IT·수전 구분), 일정, 사업자, 임차인을 넣고 "basis" 를 쓴다.



--- N4: 투자·금융·해외 규제 + 금융권 시각 ---

(1) items 로 올릴 것 (cat: PE·VC·투자, 정책·규제): AI 투자·딜, AI 인프라 금융·신용(채권·대출·사모 신용·등급 조치), 해외 규제.

(2) finance 배열로 올릴 것: 금융권 인물·기관이 AI 수요·capex·버블·자금 조달에 대해 한 발언과 글. 투자 판단용이 아니라 자금 조달 여건·거래 상대방 신용·ROI·수요 전망 관점이다.

 형식: {"id","who":"소속 + 이름","stance":"낙관|경계|중립","theme","title","claim":"주장 1~2문장","evidence":[원문 문장],"url","date":"MM/DD","pub","type":"글|인터뷰|보고서|조치","daily_worthy":bool,"business_signal","verified","paywall","rank_hint"}

 - daily_worthy=true 는 등급 조치·대출 결정·대형 펀드 조성·공식 경고 같은 "조치"일 때만이다.

 - 자기 포트폴리오와 관련된 발언이면 claim 에 그 사실을 밝힌다. 공매도 포지션을 공개한 인물도 밝힌다.

 - 낙관 쪽과 경계 쪽을 모두 일부러 찾는다(한쪽만 모으지 않는다).

기관 페이지(매일): Apollo Daily Spark https://www.apolloacademy.com/the-daily-spark/ / BlackRock Investment Institute weekly commentary / Goldman Sachs insights / Blackstone insights / Brookfield press releases / KKR insights / Moody's insights / 연준 연설 https://www.federalreserve.gov/feeds/speeches_and_testimony.xml / IMF Blogs https://www.imf.org/en/Blogs / 영란은행 https://www.bankofengland.co.uk/rss/news

기관 페이지(주 1회면 충분): Morgan Stanley, BofA Institute, Oaktree, Coatue(https://www.coatue.com/), Ramp AI Index(https://ramp.com/data/ai-index, 새 달 수치가 나왔을 때만), Menlo Ventures(시장 보고서만), Blue Owl(데이터센터 자금 조달 보도자료), Paul Kedrosky(https://paulkedrosky.com/), Michael Burry(https://michaeljburry.substack.com/archive), JPMorgan Eye on the Market(Michael Cembalest), Bridgewater research, Vista Equity Partners insights, EQT ThinQ, ARK Invest, Lux Capital 분기 레터, Citadel Securities(공식 사이트와 언론 인용)

인물(매일 검색)

 A. Jamie Dimon, Larry Fink, Jon Gray, Bruce Flatt, Torsten Slok, Michael Cembalest, Howard Marks, Ray Dalio, Greg Jensen, Ken Griffin, Scott Rubner, Jim Esposito

 B. 낙관: Philippe Laffont, Gavin Baker, Brad Gerstner, Stan Druckenmiller, Paul Tudor Jones, Dan Loeb, Chase Coleman, Leopold Aschenbrenner, Cathie Wood / 경계: Paul Kedrosky, Michael Burry, Jim Chanos, David Einhorn

 C. Orlando Bravo, Robert F. Smith, Egon Durban, Marc Ganzi, Marc Lipschultz, Josh Wolfe, David Cahn

 D. 신용: 네오클라우드·Oracle·데이터센터 채권의 등급 조치(Moody's, S&P Global Ratings, Fitch), 데이터센터 사모 신용 조달

 E. 명단 밖 거물: "hedge fund billionaire AI bubble", "investor AI capex warning", "investor bullish AI stocks" 같은 일반 검색으로 위 명단에 없는 대형 운용사·투자자의 발언을 찾는다.

 X(트위터) 게시물만 있는 발언은 언론이 인용했을 때만 쓴다.



--- E: 실적·실적 콜·투자자의 날 ---

cat: 실적. 주가는 쓰지 않는다. AI 매출 비중, 기존 사업 잠식, 수주, 가이던스, capex, 원가를 본다.

최근 3영업일 안에 실적 콜을 연 아래 기업을 매번 확인한다. 실적 시즌에는 발표 일정을 먼저 확인하고 calendar 에 넣는다.

 - 하이퍼스케일러·AI 인프라: Microsoft, Alphabet, Amazon, Meta, Oracle, SpaceX, CoreWeave, Nebius

 - 글로벌 IT서비스 11사(매번 최근 발표일 확인): Accenture, IBM, Cognizant, Capgemini, Infosys, TCS, Wipro, HCLTech, Tech Mahindra, LTIMindtree, NTT DATA

 - 국내 IT서비스·클라우드: N3 의 대상 기업

 - 전력: GE Vernova, Bloom Energy, Quanta Services, Cameco, Constellation Energy, Vistra, Talen Energy, Eaton, Vertiv, Oklo

 - 반도체: NVIDIA, AMD, Broadcom, Marvell, Intel, TSMC, ASML, ASM International, KLA, Applied Materials, Tokyo Electron, Lam Research, 삼성전자, SK하이닉스, Micron, Kioxia, Sandisk

 - 서버·스토리지: Dell, HPE, Super Micro, Lenovo, Quanta Computer, Foxconn, Wiwynn, Wistron, Inventec, Celestica, Pure Storage, NetApp

전사본 경로: 회사 IR(전사 PDF), 인도 IT는 NSE 공시 전사본, Motley Fool, Investing.com, stockanalysis.com/stocks/<티커>/transcripts/, Earnings Whispers, Singjupost, roic.ai. Seeking Alpha 는 쓰지 않는다.

실적 후보에는 공통 형식에 아래를 추가한다:

 "company", "key":"영문 소문자 약칭(예 msft, googl, amzn, meta, orcl, crwv, nbis, acn, ibm, ctsh, infy, tcs, tsmc, skhynix, samsung, mu, vrt, gev, dell, smci)",

 "quarter":"회사 회계 분기 표기(예 3Q26, FY27 Q1)", "transcript_url", "call_deep": bool, "investor_day": bool,

 "notes":[{"t":"prepared|qa","speaker":"이름(직함)","point":"요지 한국어 1~2문장","evidence":"원문 문장"}] (5~7개),

 "mem_note": {"company","quarter","date":"YYYY-MM-DD","speaker","points":["요지(수치 포함)"],"quote":"25단어 미만","url"}

 - call_deep=true 는 전사본(또는 발언 원문의 절반 이상)을 확보한 경우다. 위 하이퍼스케일러·AI 인프라, 글로벌 IT서비스 11사, 전력·반도체·서버 기업은 전사본이 있으면 항상 true 다. true 면 7절의 원문 팩을 반드시 만든다.

 - mem_note 는 메모리(DRAM·HBM·NAND·SSD) 가격·공급·원가 전가·장기 계약 발언이 있을 때만 쓴다. 뉴스 후보가 아니어도 이 필드만 담은 항목으로 올린다.

투자자의 날: Investor Day, Analyst Day, Financial Analyst Meeting, Capital Markets Day, Strategy Day 를 실적 콜과 같은 무게로 본다. 위 대상 기업의 행사가 최근 7일 안에 열렸으면 올린다(investor_day=true). 중기 목표(매출·이익률·EPS·FCF), capex·자금 조달, 수주잔고·용량(GW) 목표를 먼저 본다. 전사본이 없고 보도자료뿐이면 뉴스 후보로만 올리고 7일 동안 매일 전사본을 다시 찾는다.



--- T1: 데이터센터·인프라 전문지 ---

DatacenterDynamics https://www.datacenterdynamics.com/en/rss/ / Data Center Knowledge https://www.datacenterknowledge.com/rss.xml / Data Center Frontier / Utility Dive https://www.utilitydive.com/feeds/news/ / Latitude Media https://www.latitudemedia.com/feed/ / The Next Platform https://www.nextplatform.com/feed/ / ServeTheHome http://feeds.feedburner.com/servethehome / Blocks & Files https://www.blocksandfiles.com/feed/ / HPCwire https://www.hpcwire.com/feed/ / 보조: Tom's Hardware, EE Times, Light Reading

리뷰·벤치마크·소비자 하드웨어·후원 기사는 뺀다. 기업의 구매·설계·운영 판단에 영향을 주는 것만 남긴다.



--- T2: 기업 IT 전문지 ---

The Register https://www.theregister.com/headlines.atom / SiliconANGLE https://siliconangle.com/feed/ / Channel Dive https://www.channeldive.com/feeds/news/ / CIO Dive https://www.ciodive.com/feeds/news/ / 바이라인네트워크 https://byline.network/feed/

클라우드 장애·가격·약관, 기업 소프트웨어, 보안 사고(cat "보안"), 채널·파트너 정책.



--- TW: 대만 AI·공급망 ---

피드: DIGITIMES https://www.digitimes.com/rss/daily.xml / CNA 기술 https://feeds.feedburner.com/rsscna/technology / Focus Taiwan https://feeds.feedburner.com/rsscna/engnews/ / TechNews https://technews.tw/feed/ / Economic Daily News 산업 https://money.udn.com/money/cate/5591 / Taipei Times 경제 https://www.taipeitimes.com/News/biz / TrendForce https://www.trendforce.com/presscenter/news / Commercial Times(ctee.com.tw) / iThome / cnyes / Business Next(bnext.com.tw)

검색은 번체 중문 검색어를 반드시 섞는다. 예: AI 서버 출하, NVIDIA 공급망, Foxconn AI 서버, Quanta·Wistron·Wiwynn 수주, CoWoS 증설, 액체냉각, Delta Electronics 데이터센터, 대만 소버린 AI, Taipower AI 전력 수요, 기업 생성형 AI 도입 (각각 번체 표현으로 검색)

찾을 것: AI 서버·랙 ODM 의 수주·출하·증설·해외 공장, GPU·ASIC·CoWoS·첨단 패키징 공급, 데이터센터 전력·냉각 부품, 대만 공급망을 통해 드러난 하이퍼스케일러·AI 랩의 주문·capex 신호, 대만 AI 데이터센터·전력 정책.

규칙

 - 공급망 소식통 기반 보도는 "rumor":true 로 표시하고, 제목 끝에 "(대만 보도)"를 붙이고, facts 에 "공급망 소식통 인용, 회사 미확인"을 넣는다. rank_hint 는 최대 3.

 - 매달 10일 전후에 Foxconn·Quanta·Wistron·Wiwynn·Inventec·TSMC 월매출 공시가 나오면 1건으로 묶어 올린다(cat "실적").

 - 주가·시황 기사, AI 서버와 무관한 소비자 기기 기사는 뺀다.

 - evidence 는 번체 원문 그대로, 나머지는 한국어와 영문 표기로 쓴다.



--- P: 팟캐스트·인터뷰 ---

podcasts 배열로 올린다. 최근 7일 안에 공개된 에피소드 전부(관련 없는 것도 relevant=false 로).

소스(하나도 빠뜨리지 않고 확인): Sequoia Training Data, Dwarkesh(https://www.dwarkesh.com/feed), Latent Space(https://www.latent.space/feed), Lex Fridman, Acquired, SemiAnalysis Weekly, No Priors(https://feeds.megaphone.fm/nopriors), a16z, All-In(allin.com/episodes), Invest Like the Best, Cheeky Pint, Decoder, BG2, Big Technology, Stratechery·Sharp Tech(무료 부분). Hard Fork 는 제외.

형식: {"id","podcast","title","date":"MM/DD","pub","url","guests","relevant":bool,"basis":"전문(공식 전사본)|전문(제3자 전사본)|자막|쇼노트|언론 보도","importance":1~5,"famous":bool,

       "notes":[{"t":"시각 또는 순서","speaker","point","evidence"}] (5~7개),"terms":["이 맥락에서 뜻이 특수한 용어"],"bias":"화자의 이해관계","transcript_url"}

importance 4 이상은 전사본을 끝까지 읽고 7절의 원문 팩을 만든다.



--- CM: 커뮤니티 신호 ---

Hacker News(https://hn.algolia.com/api/v1/search?tags=front_page, 기간 내 200점 이상)와 GeekNews(https://news.hada.io/rss/news).

남길 것: AI 모델·플랫폼, 클라우드 장애·가격·약관, 데이터센터·인프라, 기업 소프트웨어·보안 사고, 국내 기업·기관 AI 사례.

버릴 것: Show HN, 개인 에세이, 코딩 팁, 취미, 번역 재게시.

커뮤니티 글을 출처로 쓰지 않는다. 원문을 열어 발행일을 확인한 뒤 원문을 url 로 쓰고, 공통 형식에 "community":{"site":"HN|GeekNews","points","comments","thread_url"} 과 "reaction"(500점 이상일 때 상위 댓글 10~15개를 읽고 쓴 개발자 반응 1~2문장)을 추가한다.



--- L: AI 현주소 ---

lens.items 로 올린다. 최근 7일 안의 글(다른 레인보다 넓다).

두 종류: "현주소"(AI 가 지금 무엇을 잘하고 못하는지 수치·사례로 보여 주는 글: 게임·퍼즐 벤치마크, 업무 자동화 실험, 사람과의 비교, 의외의 실패·이상 행동, 연구기관 측정) / "브레이크스루"(수학·과학 난제에 AI 가 결정적으로 기여했다는 발표)

소스: Epoch AI https://epoch.ai/latest / Quanta Magazine / METR https://metr.org/blog / ARC Prize https://arcprize.org/blog / Simon Willison / Terence Tao 블로그 / Import AI / Google DeepMind 블로그 / Anthropic Research / OpenAI Research / arXiv / Nature·Science·New Scientist 의 AI 과학 성과 보도 / Hacker News 200점 이상

버릴 것: 제품 출시·요금·투자·실적, 회사가 자체 발표한 벤치마크 점수만 있는 홍보, 루머, 근거 없는 의견.

형식: {"id","kind":"현주소|브레이크스루","field":"게임|업무|수학|물리|생물|화학·소재|컴퓨터과학|안전|기타","title","facts":[2~4],"evidence":[1~3],"why_fun":"무엇이 의외인지 한 줄","ai_now":"이 글로 본 AI 의 현재 위치 한 줄","source","url","date","pub","verified"}

lens.tracker_news: 과거에 발표된 AI 브레이크스루 주장의 검증 상태가 바뀐 소식(동료 평가 게재, 오류·반례 발견, 철회, 공식 인정, 저명 전문가의 공개 검토, 범위·우선권 반론).

 형식: {"claim_title","who","new_status":"발표|검증 중|확인|논란|철회","text":"무슨 일이 있었는지 한 줄","date":"YYYY-MM-DD","url","evidence"}



--- MEM: 메모리 현물가 (매일) ---

https://www.dramexchange.com/ 메인의 'DRAM Spot Price'·'Wafer Spot Price' 표에서 'Last Update' 시각(GMT+8)과 아래 세 품목의 Session Average 를 읽는다.

 DDR5 16Gb (2Gx8) 4800/5600 / DDR4 8Gb (1Gx8) 3200 / 512Gb TLC(웨이퍼)

실패하면 https://www.trendforce.com/price/dram/dram_spot 에서 DRAM 두 품목만 읽는다. 표의 날짜가 오늘·어제가 아니면(캐시) 쓰지 않는다.

형식: "mem_spot":{"source_url","last_update":"표에 적힌 갱신 시각","series":[{"key":"dram-ddr5-16gb-spot","date":"YYYY-MM-DD","value":숫자},{"key":"dram-ddr4-8gb-spot-weekly",...},{"key":"nand-tlc512-wafer-spot",...}],"status":"ok|stale|fail"}

key 는 이 셋 그대로 쓴다. 검색 결과 요약의 숫자는 쓰지 않는다.





========================================

7. 원문 팩 (feed/src/<id>.json)

========================================

실적 콜(call_deep=true), 투자자의 날, importance 4 이상 팟캐스트·인터뷰마다 하나씩 만든다. 편집 시스템이 이 파일로 심층 리포트를 쓴다.

id 규칙: 실적 콜 "iv-<key>-<분기 소문자>-call"(예 iv-msft-1q-fy27-call, iv-googl-3q26-call) / 투자자의 날 "iv-<key>-investor-day-<연도>" / 팟캐스트 "pod-<쇼 약칭>-<YYYYMMDD>"

{

 "format": "collector-src/1", "id", "kind": "earnings_call|investor_day|podcast|interview",

 "company", "key", "period", "date": "YYYY-MM-DD", "title",

 "speakers": [{"name","title"}],

 "sources": [{"title","url","type":"IR 전사본|제3자 전사본|슬라이드|보도자료|공시(8-K 등)|자막|쇼노트","coverage":"FULL|PARTIAL(약 N%)"}],

 "numbers": [{"metric","value","unit","period","yoy","qoq","note","source_url","evidence":"그 숫자가 나온 원문 문장"}],

 "guidance": [{"item","period","text","source_url","evidence"}],

 "segments": [{"n":순번,"t":"prepared|qa","speaker":"이름(직함)","asker":"질문자(소속)","topic","point":"발언 내용을 한국어로 충실히 재서술 2~5문장","quote":"원문 직접 인용 25단어 미만(선택)"}],

 "mem_note": {...} (해당할 때),

 "coverage_note": "어디까지 확보했고 무엇이 빠졌는지"

}

- segments 는 질의응답까지 순서대로 30~80개다. 줄이지 말고 발언 순서를 그대로 따라간다. 사회자 인사, 면책 문구는 뺀다.

- numbers 는 매출·부문 매출·성장률·이익률·capex·수주잔고·용량(GW·MW)·고객 수·가이던스 등 원문에 나온 핵심 수치를 20~40개 싣는다. 회사 회계 분기와 달력 분기가 다르면 period 에 둘 다 적는다.

- 전사본 전체를 그대로 싣지 않는다(재서술 + 짧은 인용).

- 원문을 찾지 못했으면 팩을 만들지 않고, 그 항목의 notes 맨 끝에 "원문 미확보: 시도한 곳 …"을 적고 7일 동안 매일 다시 찾는다.





========================================

8. 주간 묶음 형식 (feed/weekly/YYYY-Www.json)

========================================

중요한 원칙: 너는 편집 시스템이 지금 갖고 있는 값과 id 를 모른다. 그래서 "바뀐 것"만 싣지 말고 "이번 주에 원문에서 직접 본 값 전체"를 싣는다. 지난주 네 묶음과 달라진 값에는 "changed":true 와 "prev" 를 덧붙인다. 비교는 편집 시스템이 한다.

{

 "format": "collector-weekly/1", "week": "YYYY-Www", "revision": 1, "made_kst", "status",

 "sections": {"<절 코드>": {"status","note","failed_sources":[]}},

 "gpu": {...}, "memory": {...}, "labs": [...], "dc_kr": [...], "dc_global": {...},

 "competitors": [...], "model_prices": {...}, "capex": {...}, "f13": [...], "calendar": [...]

}



--- G: GPU 임대 가격 ---

(1) 요금표 스냅샷. 아래 사업자의 공개 가격 페이지를 열어 GPU 상품 단가를 빠짐없이 옮긴다. JavaScript 로 그려지는 페이지도 브라우저로 열어 화면에 보이는 값을 읽는다.

 하이퍼스케일러: AWS(온디맨드, Capacity Blocks), Azure, Google Cloud, Oracle

 네오클라우드: CoreWeave, Crusoe, DigitalOcean, Fluidstack, Genesis Cloud, Hyperstack, Lambda, Nebius, Paperspace, Scaleway, Together AI, Voltage Park, Vultr

 마켓플레이스: Prime Intellect, RunPod, SF Compute, Shadeform, TensorDock, Vast.ai

 국내: KT클라우드, NHN클라우드, Runyour AI, SK텔레콤 GPUaaS, VESSL AI, 네이버클라우드, 삼성SDS 클라우드(SCP), 엘리스클라우드, 카카오클라우드

 공개 가격표가 있는 다른 사업자를 찾으면 추가한다.

 대상 GPU: B300, B200, GB300, GB200, H200, H100, A100, L40S, L4, MI355X, MI325X, MI300X

 "gpu":{"pages":[{"provider","group":"하이퍼스케일러|네오클라우드|마켓플레이스|국내","url","checked":"YYYY-MM-DD","status":"ok|부분|못 읽음","why":"",

   "offers":[{"gpu","variant":"SXM·PCIe·메모리 등","sku":"상품·인스턴스 이름","n_gpu":묶음의 GPU 수,"commit":"온디맨드|스팟|1년 약정|3년 약정|예약 N개월|Capacity Block|별도 견적",

              "region":"화면에 적힌 리전","region_group":"미국|EMEA|아시아|기타|미표기","unit_price":화면의 숫자,"currency":"USD|KRW|EUR","unit":"GPU·시간|서버·시간|월",

              "per_gpu_hour":GPU 1개·1시간으로 맞춘 값,"vat":"포함|별도|미표기","evidence":"화면의 해당 줄 글자 그대로","changed":bool,"prev":지난주 값}]}]}

 - 값은 화면에 적힌 숫자만 쓴다. 8GPU 서버 가격은 GPU 수로 나눠 per_gpu_hour 를 계산하고 unit_price 는 원래 값 그대로 둔다.

 - 리전마다 가격이 다르면 리전별로 줄을 나눈다(미국·EMEA·아시아를 구분해 본다).

 - 못 읽은 페이지는 값을 지어내지 않고 status "못 읽음"과 이유를 쓴다.

(2) 시세 지수

 - GetDeploying 주간 CSV: https://getdeploying.com/dataset/gpu-prices/nvidia-b300.csv (b200, h200, h100, a100 도 같은 형식). billing_type 이 ON_DEMAND 인 행의 date·provider_median_price·provider_count 를 최근 8주치 싣는다. 12개월 예약 값이 있으면 같이 싣는다.

 - Ornn 공개 지수: https://data.ornn.com/api/public-index/gpu/H100%20SXM/index-history (H200, B200, A100 도) 최근 8주치.

 - Silicon Data 지수(silicondata.com)의 공개 값.

 "indices":[{"key":"gd-od|gd-1y|ornn|sd-hyper|sd-neo|sd-mkt","gpu","date","value","n","source_url"}]

(3) 지난 7일의 가격 사건: 임대 가격 인상·인하, 신규 GPU 출시가, 국내 GPUaaS 요금 소식. "events":[{"date","provider","group","text":"한국어 한 문장(예전 값 → 새 값)","url","evidence"}]

(4) 환율: 원/달러 최근 고시값. "fx":{"krw_per_usd","date","source_url"}



--- M: 부품 원가 ---

"memory":{

 "contract":[{"key":"dram-ddr4-8gb-contract|dram-rdimm-64gb-contract|nand-mlc128-contract","date","value","unit","source","url","evidence"}],

 "cpu":[{"key":"cpu-xeon-6980p-rcp","date","value","source":"Intel ARK 권장 고객가","url"}],

 "events":[{"date","group":"DRAM|NAND|CPU","text":"한국어 한 문장","url","evidence"}],

 "qoq":[{"q":"4Q26","cat":"전체 범용 DRAM|Server DRAM|PC DRAM|Mobile DRAM|전체 NAND|Enterprise SSD|Client SSD","group":"DRAM|NAND","lo","hi","kind":"전망|실측","src","url","date","evidence"}]}

 - 고정거래가: DDR4 8Gb, 서버 DDR5 RDIMM 64GB, NAND 128Gb MLC 의 월말 발표값(DRAMeXchange·TrendForce 보도자료, CFM MemoryMarket, Counterpoint, 국내 언론의 월말 기사).

 - TrendForce 가 새 분기 가격 전망을 내거나 지난 분기 실측을 밝히면 qoq 로 싣는다.

 - HBM 가격은 다루지 않는다.



--- LAB: AI 랩 매출·사용량 ---

"labs":[{"key":"openai-arr|anthropic-arr|google-api-tpm|google-tokens","date":"보도·발언일","value","unit","estimate":bool,"source","url","evidence"}]

지난 7일에 새로 보도된 OpenAI·Anthropic 연환산 매출, Google API 분당 토큰·월간 처리 토큰. 매출 인식 기준(순액·총액)이 원문에 있으면 note 로 적는다.



--- DK: 국내 데이터센터 ---

지난 7일의 국내 데이터센터 소식 전부(일간 N3 에서 올린 것 포함, 여기서는 시설 단위로 정리).

"dc_kr":[{"facility":"시설 이름","operator":"사업자","region":"시도","city":"시군구",

  "event":"신규 발표|부지 확보|인허가|착공|준공|가동|증설|지연|재검토|취소|임차 계약|매각",

  "status_after":"운영|공사 중|계획","mw":숫자 또는 null,"basis":"IT|수전|미상","target":"YYYY 또는 YYYY-MM",

  "phases":[{"label":"1동 등","mw","basis","when":"가동·준공 시점","when_basis":"RFS|준공|연도만"}],

  "tenants":[{"name":"임차인(모르면 비공개)","mw","kind":"자가|앵커|선임차|임차|완판|보도(미확인)"}],

  "ai_ready":{"rack_kw":공식 수치만,"cooling":"냉각 방식","gpu":"GPU 수량·모델","note"},

  "text":"무엇이 바뀌었는지 한 줄","source":{"title","url","pub"},"evidence":[...],"verified"}]

 - 임차인·선임차 정보는 투자은행 쪽 보도(딜사이트, 더벨, IB토마토, fn마켓워치 등)에 많다. 따로 검색한다.

 - 협상·MOU·LOI 는 kind "보도(미확인)"으로만 쓴다.

 - 이름이나 홍보 문구에 'AI'가 있다는 것만으로 ai_ready 를 채우지 않는다. 랙당 kW, 액체냉각, GPU 배치가 회사 자료·보도로 확인된 것만 쓴다.



--- DG: 글로벌 빅테크 데이터센터 ---

대상 8개사: AWS(Amazon), Microsoft, Google, Meta, Oracle, OpenAI, xAI(SpaceX 계열 포함), Anthropic

"dc_global":{

 "epoch":{"updated":"Epoch 데이터 갱신일","rows":[{"name","current_mw","owner","users":"표기 그대로(#confident 등 포함)","directory_url"}],

          "timelines":[{"name","tl":[["YYYY-MM-DD",누적 IT MW,"실측|전망"]]}]},

 "plans":[{"name","tenant","owner","country","loc","announced":"YYYY-MM-DD","target","mw","basis":"IT|power|unknown","stage":"발표|부지확보|인허가|착공 보도|취소·보류","text","src":[["제목","URL","YYYY-MM-DD"]],"evidence"}]}

 - Epoch: https://epoch.ai/data/data_centers/data_centers.csv 에서 Owner 나 Users 에 8개사가 있는 캠퍼스 행을 전부 rows 로 싣는다. 지난주 대비 Current power 가 5% 또는 20MW 넘게 바뀌었거나 새로 생긴 캠퍼스는 디렉터리 페이지(https://epoch.ai/data/ai-data-centers/directory/<slug>)의 Buildout 타임라인을 timelines 로 싣는다.

 - plans: 지난 7일의 약 100MW 이상 AI 캠퍼스 소식(새 발표, 착공, 용량·일정 변경, 취소·보류). 사용 회사(테넌트) 기준으로 쓴다.



--- K: 경쟁사 움직임 ---

대상: 삼성SDS, LG CNS, SK AX, 현대오토에버, 포스코DX, 롯데이노베이트, CJ올리브네트웍스, KT·KT클라우드, 네이버클라우드, NHN클라우드, 카카오, SK텔레콤, 메가존클라우드, Accenture, IBM, NTT DATA, TCS, Infosys

"competitors":[{"company","d":"YYYY-MM-DD","t":"한국어 한 줄 70자 이내","k":"AI|클라우드|DC|수주|M&A·투자|제휴|조직·인사|실적","url","evidence"}]

 - 지난 7일의 전략적 움직임: 대형 제휴, 신규 사업·제품, 조직 개편·대표 교체, 투자·인수, AI 데이터센터·GPU 확보, 해외 진출. 소규모 수주는 넣지 않는다.

 - 새 분기 실적을 발표한 회사는 {"company","fin":{"period","rev","op","yoy","url","date","evidence"}} 로 싣는다.



--- MP: 모델 가격 ---

"model_prices":{

 "aa":{"checked":"YYYY-MM-DD","index_name":"지수 이름·버전","rows":[{"model","creator","open_weights":bool,"index","price_in","price_out","speed_tps","ttft_s","context","released","url"}]},

 "providers":[{"model","rows":[{"provider","price_in","price_out","speed_tps","ttft_s","quant","src":"AA|OpenRouter","url"}]}],

 "official":[{"vendor","model","tier":"flagship|mid|small","price_in","price_out","cached_in","context","url","checked"}],

 "events":[{"d","vendor","t":"한국어 한 문장","url","evidence"}]}

 - Artificial Analysis: https://artificialanalysis.ai/leaderboards/models 표에서 상위 폐쇄형·오픈 웨이트·국내 모델을 rows 로 싣는다(약 40~60개). 숫자 필드는 숫자만 쓴다(context 1000000, "1M" 금지).

 - 주요 오픈 모델의 사업자별 서빙 단가는 AA 사업자 페이지와 OpenRouter 모델 페이지에서 읽는다.

 - 공식 요금: OpenAI, Anthropic, Google, xAI, Mistral, DeepSeek, Alibaba, 국내 주요 모델의 공개 요금표.

 - 화면에 적힌 숫자만 쓴다. API 키가 필요한 곳은 쓰지 않는다.



--- CX: 빅테크 설비투자 ---

"capex":{"quarters":[{"company","quarter":"달력 분기(예 3Q26)","fiscal":"회사 회계 분기 표기","capex":현금흐름표 유형자산 취득액(십억 달러, 소수 1자리),"total_incl_leases":숫자 또는 null,"source":{"title","url","date"},"evidence"}],

          "guidance":[{"company","period","text","date","url","evidence"}]}

대상: Microsoft, Alphabet, Amazon, Meta, Oracle. 지난 7일에 새 분기 실적이 나온 회사만. 원문(실적 보도자료·10-Q)에서 확인한 숫자만 쓴다.



--- F13: 13F 분기 점검 (해당 주에만) ---

13F 제출 마감(2/14, 5/15, 8/14, 11/14, 주말이면 다음 영업일)이 지난 7일 안에 있었던 주에만 한다.

대상: Coatue, Atreides, Altimeter, Situational Awareness, Duquesne Family Office, Tiger Global, Whale Rock, D1 Capital. 13f.info 에서 직전 분기와 비교한다.

"f13":[{"manager","quarter","filed":"YYYY-MM-DD","changes":[{"ticker","name","action":"신규|전량 매도|확대|축소","shares_prev","shares_now","value_usd","pct_of_portfolio"}],"url"}]

NVIDIA, TSMC, 메모리, 네오클라우드, 전력, 데이터센터 종목만 싣는다. 주가 해설은 쓰지 않는다.



--- CAL: 앞으로 3주 일정 ---

"calendar":[{"date":"YYYY-MM-DD","company","what","confirmed":bool,"url"}]

6절 E 의 대상 기업 실적 발표일·콜 시각, 투자자의 날, 주요 업계 행사(GTC, re:Invent, Ignite, OCP, SC 등), 규제 의견 마감일. 회사 IR 로 확인한 것만 confirmed=true.





========================================

9. feed/index.json 과 feed/health.json

========================================

feed/index.json

{

 "format": "collector-index/1", "updated_kst": "YYYY-MM-DD HH:MM",

 "daily": {"latest": "YYYY-MM-DD", "url": "feed/daily/YYYY-MM-DD.json", "status", "revision", "counts": {"items":0,"finance":0,"podcasts":0,"lens":0,"packs":0}, "empty_lanes": [], "failed_lanes": []},

 "weekly": {"latest": "YYYY-Www", "url": "...", "status", "revision", "empty_sections": [], "failed_sections": []},

 "files": [{"url","bytes","made_kst"}],

 "notes": "오늘 특이사항 한두 줄(늦은 이유, 못 연 주요 소스)"

}

feed/health.json

{"updated_kst","sources":[{"name","url","lane","last_ok","last_fail","consecutive_failures","why"}]}

연속 3회 실패한 소스는 대체 주소나 대체 소스를 찾아 보고 QUESTIONS.md 에 적는다.





========================================

10. 실행 방식

========================================

- 레인·절은 서로 독립이다. 병렬로 돌려도 되고, 하나가 실패해도 나머지는 게시한다.

- 깊게 찾는다. 레인마다 담당 피드를 전부 확인한 뒤 검색을 최소 8회 이상 한다(N3·N4·E 는 15회 이상). 후보로 남길 기사는 반드시 원문을 연다.

- 모든 숫자는 네가 직접 연 페이지에서 본 것이어야 한다. 기억이나 추정으로 채우지 않는다.

- 게시 전에 스스로 검사한다(11절). 검사에 실패한 항목은 빼거나 고친 뒤 올린다.

- 사람에게 묻지 않고 끝까지 진행한다. 판단이 어려웠던 것은 QUESTIONS.md 에 남긴다.





========================================

11. 게시 전 자동 검사 (스크립트로 만들어 매번 실행)

========================================

1) JSON 문법, format 값, 필수 필드가 있는지.

2) 모든 항목에 url(http 로 시작, 구글 뉴스·검색 주소 아님), pub(YYYY-MM-DD), evidence(1개 이상)가 있는지.

3) pub 가 수집 기간 안인지(예외: P·L 은 7일, 실적 콜은 3영업일, 투자자의 날은 7일).

4) facts 의 숫자가 evidence 문장에 있는지(단위 환산은 허용). 없으면 그 숫자를 빼거나 verified=false.

5) evidence 밖 글에 한자가 없는지(유니코드 CJK 한자 범위 검사).

6) cat·stance·kind 등 정해진 값 목록을 벗어나지 않았는지.

7) seen.json 과 같은 URL 이 없는지(followup 제외).

8) 용량이 있는 항목에 basis 가 있는지.

9) 파일 크기 1.5MB 이하인지, latest.json 이 날짜 파일과 같은지.

10) 검사 결과를 묶음의 "checks":{"passed","fixed","dropped"} 로 남긴다.





========================================

12. 처음 할 일 (순서대로)

========================================

1) 이 지시문을 feed/SPEC.md 로 저장하고, feed/ 폴더 구조와 11절 검사 스크립트를 만든다. 기존 화면과 data/ 는 건드리지 않는다.

2) 6절·8절의 소스 주소를 모두 한 번씩 열어 보고 feed/health.json 을 만든다. 못 여는 소스는 대체 경로를 찾는다.

3) 오늘 날짜로 일간 묶음을 한 번 만들어 게시한다(시험 실행). 이어서 이번 주 주간 묶음도 한 번 만든다.

4) 3절의 일정으로 예약 실행을 건다(일간 평일 07:30, 주간 월요일 06:00, 한국 시각).

5) 끝나면 아래를 대화로 보고한다:

   - 게시된 주소 목록과 파일 크기

   - 레인·절별 건수, 0건 레인과 그 이유

   - 못 연 소스 목록과 대체 방법

   - 지시문에서 모호했거나 바꾸는 게 낫다고 본 점(QUESTIONS.md 요약)

   - 일간·주간 한 번에 든 시간

---
변경 이력: 2026-11-10 사용자 지시문 v1 원문 보존.


## 2026-11-10 사용자 정정 — 상세 본문 분석

사용자 정정: “본문 통째 게재는 막지말아라. 그건 잘못된 지시였다. 본문을 최대한 상세하게 분석하는 것은 필요한 사항인데 지시문을 잘못 만들었다. 그 부분만 고쳐서 다시 진행”

위 원문 사본의 4-7절과 7절 중 본문 활용을 일괄 제한하는 문구보다 이 정정을 우선한다. 원문 전체를 정상 경로로 확보할 수 있으면 끝까지 읽고, 수치·조건·발언 순서·질의응답·반론·예외를 상세히 분석한다. 30~80개 segments 및 20~40개 numbers는 확인한 원문 범위 안에서 충실히 작성한다. 분석량을 단순 글자 수로 줄이거나 본문 미확보를 전문 분석으로 표시하지 않는다.

공개 재배포 권한이 확인된 자료(직접 작성, 퍼블릭 도메인, 전문 재배포 허용 라이선스 등)는 라이선스·출처를 명시해 전문 공개할 수 있다. 그 외 제3자 저작물은 전문 공개 대신 상세한 독자적 재서술과 필요한 짧은 인용을 사용한다. 유료 장벽·로그인·차단 우회 금지는 유지한다. 같은 출처의 직접 인용은 묶음과 원문 팩을 합산하여 25단어 미만으로 관리한다. 원문 길이에 비례한 대체물을 만들지 않으며, 권리나 허용 범위가 불명확한 자료는 QUESTIONS.md에 기록한다.

## 2026-11-11 검증 구현 보완

실적 원문 팩의 숫자 근거에는 공식 재무표의 비표현적 셀 행을 사용할 수 있다. numbers[].evidence_kind가 data_row인 경우 행 이름·기간·단위·수치를 보존하고 문장 인용과 구별한다. 단순 라벨 지정으로 표현적인 문장을 면제하지 않으며 자동 형식 검사와 원문 대조를 함께 수행한다. 기사·콜 발언 문장과 segments.quote의 출처별 짧은 인용 한도는 유지한다.

공식 실적발표 자료만 확인한 후보는 release_only=true, call_deep=false, transcript_url="", notes=[]로 표시한다. 아직 열리지 않았거나 확인되지 않은 콜의 발언을 생성하지 않는다. 이 후보에는 일반 뉴스 수집 기간을 적용하며 실적 콜의 3영업일 예외를 적용하지 않는다.

## 2026-11-11 게시 연동 정정

사용자의 게시 지시에 따라 기존 게시기에 필요한 최소 연동을 수행합니다. 검증된 Collector 공개 파일만 exporter에 연결하고 공개 catalog에 feed/index.json 진입점 하나를 추가합니다. 기존 화면·원본 data/·텔레그램 내용과 예약 상태는 보존합니다. 기존 데이터의 근거 원문 제외 규칙은 유지하고 Collector 경로만 별도로 검사합니다. 미완료 게시가 있으면 다른 게시기가 덮어쓰지 않으며 검증된 원격 결과와 로컬 상태를 대조해 복구합니다.

## 2026-11-11 화면 통합·실적 콜 분리·정기 실행 정정

후속 사용자 요청에 따라 기존 Market Briefing 메뉴에 수집 자료를 통합하고, 실적 콜·투자자의 날은 별도 목록 및 개별 상세 페이지로 분리합니다. 기존 증권사·심층 리포트 본문과 공유 주소는 보존합니다. 수집 누락을 보완하고 검증·공개 게시를 마친 후 기존 일간 collector와 주간 collector-2만 활성화합니다. 기존 텔레그램과 다른 자동화 상태는 변경하지 않습니다. 최초 시험 일간 2026-11-10 및 주간 2026-W46의 기간은 계속 보존하며 정정은 revision으로 기록합니다.

같은 날짜의 분할 파일 수가 줄어드는 정정은 이전 index·부모 parts·part 메타데이터가 참조를 증명하고 새 부모의 기간과 형식이 같으며 revision이 증가한 경우에만 이전 part를 정리합니다. 정기 수집은 실행별 후보 파일을 쓰고 canonical 통합·게시 시 공유 잠금으로 직렬화합니다. 운영과 화면 연결의 자세한 규칙은 OPERATIONS.md 및 프로젝트 docs/collector-ui.md에 기록합니다.
