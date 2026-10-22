/* Moonwave UX — 서비스 간 열기의 주소 표. tools/sync_services.mjs가 Admin 기록(시스템마다 opens)에서 만들어요.
   고치지 말아요: 받는 서비스의 Admin 기록을 고친 뒤 `npm run sync`를 다시 해요. 쓰는 법은 open-in.ts와 OpenIn.tsx에 있어요. */
export const OPENS = {
  admin: {
    short: 'Admin', host: 'admin.moonwave.kr', on: true,
    opens: {
      systems: { path: '/#/systems{?q}', label: '시스템 목록 보기', need: {}, may: { q: 'text' } },
      system: { path: '/#/system/{id}', label: '시스템 기록 보기', need: { id: 'id' }, may: {} },
      hardware: { path: '/#/hardware', label: '하드웨어 보기', need: {}, may: {} },
    },
  },
  agent: {
    short: 'Agent', host: 'agent.moonwave.kr', on: true,
    opens: {
      services: { path: '/#/services', label: '서비스 보기', need: {}, may: {} },
      history: { path: '/#/history', label: '기록 보기', need: {}, may: {} },
      builder: { path: '/#/builder', label: '흐름 만들기', need: {}, may: {} },
      flow: { path: '/#/builder/{id}{?run}', label: '흐름 보기', need: { id: 'id' }, may: { run: 'id' } },
      jobs: { path: '/#/jobs', label: '자동화 보기', need: {}, may: {} },
      issues: { path: '/#/issues', label: '문제 보기', need: {}, may: {} },
    },
  },
  asset: {
    short: 'Asset', host: 'asset.moonwave.kr', on: true,
    opens: {
      data: { path: '/#/data', label: '데이터 보기', need: {}, may: {} },
      bank: { path: '/#/bank{?tab}', label: '계좌 보기', need: {}, may: { tab: 'text' } },
      portfolio: { path: '/#/portfolio{?symbol}', label: '포트폴리오 보기', need: {}, may: { symbol: 'id' } },
      upload: { path: '/#/upload{?tab,batch}', label: '올린 파일 보기', need: {}, may: { tab: 'text', batch: 'id' } },
      trades: { path: '/#/trades{?tab,symbol,day}', label: '거래 보기', need: {}, may: { tab: 'text', symbol: 'text', day: 'date' } },
      networth: { path: '/#/networth{?h,d}', label: '순자산 보기', need: {}, may: { h: 'number', d: 'number' } },
      cashflow: { path: '/#/cashflow{?m,d}', label: '현금 흐름 보기', need: {}, may: { m: 'month', d: 'date' } },
      search: { path: '/#/search{?q}', label: '찾기', need: {}, may: { q: 'text' } },
    },
  },
  auto: {
    short: 'Auto', host: 'auto.moonwave.kr', on: true,
    opens: {},
  },
  beat: {
    short: 'Beat', host: 'beat.moonwave.kr', on: true,
    opens: {},
  },
  blog: {
    short: 'Blog', host: 'blog.moonwave.kr', on: true,
    opens: {
      post: { path: '/#post/{id}', label: '글 보기', need: { id: 'id' }, may: {} },
      trip: { path: '/{?trip}', label: '여행 글 보기', need: {}, may: { trip: 'id' } },
      partner: { path: '/partner', label: '파트너 화면 열기', need: {}, may: {} },
    },
  },
  bora: {
    short: 'Bora', host: 'bora.moonwave.kr', on: true,
    opens: {},
  },
  bot: {
    short: 'Bot', host: 'bot.moonwave.kr', on: true,
    opens: {
      ask: { path: '/{?bot,ask,ctx,ctx_label}', label: '물어보기', need: {}, may: { bot: 'id', ask: 'text', ctx: 'text', ctx_label: 'text' } },
      inbox: { path: '/?notifications=1{&source,id}', label: '알림 보기', need: {}, may: { source: 'text', id: 'id' } },
      mca: { path: '/?mca=1{&account,tab,plan,step}', label: 'MCA 보기', need: {}, may: { account: 'id', tab: 'text', plan: 'id', step: 'text' } },
      agent: { path: '/?agent={item}{&flow,revision}', label: '운영 보기', need: { item: 'id' }, may: { flow: 'id', revision: 'id' } },
      ux: { path: '/?ux={item}', label: '화면 점검 보기', need: { item: 'id' }, may: {} },
      rag: { path: '/?rag={item}', label: 'RAG 피드백 보기', need: { item: 'id' }, may: {} },
      security: { path: '/?security={item}{&view}', label: '보안 보기', need: { item: 'id' }, may: { view: 'text' } },
    },
  },
  calendar: {
    short: 'Calendar', host: 'calendar.moonwave.kr', on: true,
    opens: {
      day: { path: '/#/day/{date}', label: '그날 일정 보기', need: { date: 'date' }, may: {} },
      month: { path: '/#/month/{month}{?day,trip}', label: '그달 일정 보기', need: { month: 'month' }, may: { day: 'date', trip: 'text' } },
    },
  },
  chat: {
    short: 'Chat', host: 'chat.moonwave.kr', on: true,
    opens: {
      conversation: { path: '/#/home/{id}', label: '대화 열기', need: { id: 'id' }, may: {} },
      inbox: { path: '/#/inbox', label: '공유함 열기', need: {}, may: {} },
      services: { path: '/#/services', label: '연결 보기', need: {}, may: {} },
      device: { path: '/#/device', label: '기기 설정 보기', need: {}, may: {} },
    },
  },
  dashboard: {
    short: 'Dashboard', host: 'dashboard.moonwave.kr', on: true,
    opens: {},
  },
  drive: {
    short: 'Drive', host: 'drive.moonwave.kr', on: true,
    opens: {
      file: { path: '/#/file/{id}', label: '파일 열기', need: { id: 'id' }, may: {} },
      folder: { path: '/#/shared/{id}', label: '폴더 열기', need: { id: 'id' }, may: {} },
      receive: { path: '/#/receive/{packed}', label: '메모 받기', need: { packed: 'text' }, may: {} },
    },
  },
  drop: {
    short: 'Drop', host: 'drop.moonwave.kr', on: true,
    opens: {},
  },
  folder: {
    short: 'Folder', host: 'folder.moonwave.kr', on: true,
    opens: {},
  },
  games: {
    short: 'Games', host: 'games.moonwave.kr', on: true,
    opens: {},
  },
  health: {
    short: 'Health', host: 'health.moonwave.kr', on: true,
    opens: {
      exercise: { path: '/#/p/{person}/exercise{?week}', label: '운동 기록 보기', need: { person: 'id' }, may: { week: 'date' } },
    },
  },
  kpx: {
    short: 'KPX', host: 'kpx.moonwave.kr', on: true,
    opens: {},
  },
  kpxo: {
    short: 'KPXO', host: 'kpxo.moonwave.kr', on: true,
    opens: {},
  },
  mail: {
    short: 'Mail', host: 'mail.moonwave.kr', on: true,
    opens: {
      message: { path: '/#/folder/{folder}{?uid}', label: '메일 열기', need: { folder: 'text' }, may: { uid: 'number' } },
      deliveries: { path: '/#/deliveries', label: '발송 관리 보기', need: {}, may: {} },
      drafts: { path: '/#/drafts', label: '임시보관함 보기', need: {}, may: {} },
      write: { path: '/#/write{?to,subject,drive}', label: '메일 쓰기', need: {}, may: { to: 'text', subject: 'text', drive: 'text' } },
    },
  },
  mca: {
    short: 'MCA', host: 'mca.moonwave.kr', on: true,
    opens: {
      plan: { path: '/#/plan/{id}{?tab}', label: '계획 보기', need: { id: 'number' }, may: { tab: 'text' } },
      orders: { path: '/#/orders{?f,q}', label: '주문 보기', need: {}, may: { f: 'text', q: 'text' } },
      approvals: { path: '/#/approvals', label: '승인 보기', need: {}, may: {} },
      plans: { path: '/#/plans', label: '계획 목록 보기', need: {}, may: {} },
      account: { path: '/?account={account}', label: '계좌 열기', need: { account: 'id' }, may: {} },
      'account-plans': { path: '/?account={account}#/plans', label: '계좌의 계획 보기', need: { account: 'id' }, may: {} },
      'account-plan': { path: '/?account={account}#/plan/{id}', label: '계좌의 계획 보기', need: { account: 'id', id: 'number' }, may: {} },
    },
  },
  mcp: {
    short: 'MCP', host: 'mcp.moonwave.kr', on: true,
    opens: {},
  },
  memo: {
    short: 'Memo', host: 'memo.moonwave.kr', on: true,
    opens: {
      share: { path: '/share-target{?title,text,url}', label: '메모로 받기', need: {}, may: { title: 'text', text: 'text', url: 'text' } },
      receive: { path: '/share-target#drive={packed}', label: 'Drive 글 받기', need: { packed: 'text' }, may: {} },
    },
  },
  music: {
    short: 'Music', host: 'music.moonwave.kr', on: true,
    opens: {
      track: { path: '/#/track/{id}{?t}', label: '곡 열기', need: { id: 'id' }, may: { t: 'number' } },
    },
  },
  perosona: {
    short: 'Perosona', host: 'perosona.moonwave.kr', on: true,
    opens: {},
  },
  photo: {
    short: 'Photo', host: 'photo.moonwave.kr', on: true,
    opens: {
      photo: { path: '/#/photo/{id}', label: '사진 보기', need: { id: 'number' }, may: {} },
      timeline: { path: '/#/timeline{?y,m}', label: '그달 사진 보기', need: {}, may: { y: 'number', m: 'number' } },
      similar: { path: '/#/search{?like,likes}', label: '비슷한 사진 찾기', need: {}, may: { like: 'number', likes: 'text' } },
      album: { path: '/#/albums/{folder}', label: '앨범 열기', need: { folder: 'path' }, may: {} },
      trip: { path: '/#/trip/{id}{?day}', label: '여행 사진 보기', need: { id: 'id' }, may: { day: 'number' } },
    },
  },
  position: {
    short: 'Position', host: 'position.moonwave.kr', on: true,
    opens: {},
  },
  rag: {
    short: 'RAG', host: 'rag.moonwave.kr', on: true,
    opens: {
      service: { path: '/#services/{id}', label: '서비스 보기', need: { id: 'id' }, may: {} },
      login: { path: '/auth/login', label: '로그인하기', need: {}, may: {} },
    },
  },
  security: {
    short: 'Security', host: 'security.moonwave.kr', on: true,
    opens: {},
  },
  trip: {
    short: 'Trip', host: 'trip.moonwave.kr', on: true,
    opens: {
      trip: { path: '/#/trip/{id}{?tab}', label: '여행 보기', need: { id: 'id' }, may: { tab: 'text' } },
      plan: { path: '/#/plan/{id}{?day,tab}', label: '계획 보기', need: { id: 'id' }, may: { day: 'date', tab: 'text' } },
      journey: { path: '/#/journey/{date}', label: '여정 보기', need: { date: 'date' }, may: {} },
      camp: { path: '/#/camp/{id}', label: '캠핑 예약 보기', need: { id: 'id' }, may: {} },
      stay: { path: '/#/stay/{code}', label: '숙소 예약 보기', need: { code: 'id' }, may: {} },
      photo: { path: '/#/photo/{id}', label: '사진의 여행 보기', need: { id: 'number' }, may: {} },
      trips: { path: '/#/trips', label: '여행 목록 보기', need: {}, may: {} },
      plans: { path: '/#/plans', label: '계획 목록 보기', need: {}, may: {} },
      camps: { path: '/#/camps', label: '캠핑 목록 보기', need: {}, may: {} },
      stays: { path: '/#/stays', label: '숙소 목록 보기', need: {}, may: {} },
    },
  },
  ux: {
    short: 'UX', host: 'ux.moonwave.kr', on: true,
    opens: {
      monitor: { path: '/monitor', label: '화면 점검 보기', need: {}, may: {} },
      audit: { path: '/monitor/{id}', label: '점검 결과 보기', need: { id: 'id' }, may: {} },
      trends: { path: '/monitor/trends/{week}', label: '주간 UX 동향 보기', need: { week: 'id' }, may: {} },
      trend: { path: '/monitor/trends/{week}#{item}', label: '동향 제안 보기', need: { week: 'id', item: 'id' }, may: {} },
      fixes: { path: '/monitor/fixes', label: '조치 결과 보기', need: {}, may: {} },
      day: { path: '/monitor/{id}/{date}', label: '그날 점검 결과 보기', need: { id: 'id', date: 'date' }, may: {} },
      page: { path: '/{section}/{slug}', label: '기준 보기', need: { section: 'id', slug: 'id' }, may: {} },
      rule: { path: '/{section}/{slug}#{part}', label: '기준 항목 보기', need: { section: 'id', slug: 'id', part: 'id' }, may: {} },
    },
  },
  wavie: {
    short: 'Wavie', host: 'wavie.moonwave.kr', on: true,
    opens: {},
  },
  www: {
    short: 'Moonwave', host: 'www.moonwave.kr', on: true,
    opens: {},
  },
} as const
