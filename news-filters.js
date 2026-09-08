/* Shared, deterministic topic rules for live feeds and the daily archive. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SGNewsFilters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const players = /손흥민|이강인|김민재|황희찬|황인범|이재성|양현준|양민혁|이한범|배준호|백승호|오현규|조규성|지동원|박지성|기성용|이청용|정우영|홍현석|엄지성|김지수|권혁규|설영우|이영준|이현주|정상빈|권창훈|황의조|조현우|김승규|김영권|손준호|문선민|권경원|송민규|이승우|김진수|지소연|이금민|조소현|코리안\s?리거|한국\s?선수|한국\s?축구\s?레전드|\b(?:son heung[ -]?min|heung[ -]?min son|lee kang[ -]?in|kang[ -]?in lee|kim min[ -]?jae|min[ -]?jae kim|hwang hee[ -]?chan|lee jae[ -]?sung|hwang in[ -]?beom|oh hyeon[ -]?gyu)\b/i;
  const domesticTopic = /K\s?리그|K[ -]?League|대한축구협회|한국프로축구연맹|한국\s?축구|韓\s?축구|한국\s?(?:축구\s?)?(?:대표팀|국가대표)|대한민국\s?(?:축구\s?)?(?:대표팀|국가대표)|태극전사|홍명보|KFA\b|코리아컵|전북\s?현대|울산\s?(?:HD|현대)|FC\s?서울|서울\s?이랜드|수원\s?(?:삼성|FC)|포항\s?스틸러스|대전\s?(?:하나|시티즌)|강원\s?FC|대구\s?FC|인천\s?유나이티드|제주\s?(?:SK|유나이티드)|광주\s?FC|김천\s?상무|부천\s?FC|용인\s?FC|성남\s?FC|안양\s?FC|FC\s?안양|부산\s?아이파크|김포\s?FC|천안\s?시티|충남\s?아산|충북\s?청주|경남\s?FC|전남\s?드래곤즈|화성\s?FC|안산\s?그리너스|K3리그|K4리그|WK리그/i;
  const foreignTopic = /해외\s?축구|유럽\s?축구|EPL\b|프리미어\s?리그|라리가|분데스리가|세리에\s?A|리그\s?1|챔피언스\s?리그|유로파|UEFA|MLS\b|LAFC\b|발롱도르|월드컵|토트넘|맨유|맨시티|맨체스터|아스널|아스톤\s?빌라|애스턴\s?빌라|리버풀|첼시|뉴캐슬|에버턴|본머스|브렌트퍼드|레알\s?마드리드|바르셀로나|아틀레티코|ATM\b|PSG\b|파리\s?생제르맹|바이에른|뮌헨|셀틱|마인츠|모나코|유벤투스|인터\s?밀란|AC\s?밀란|알\s?(?:나스르|힐랄|이티하드|카디시야)|케인|호날두|메시|음바페|홀란|발로군|USMNT|premier league|la\s?liga|bundesliga|serie a|ligue 1|champions league|world cup|tottenham|arsenal|chelsea|liverpool|manchester|real madrid|barcelona|bayern|celtic|messi|ronaldo|mbapp[eé]|haaland|\bkane\b/i;
  const deal = /이적|영입|임대|재계약|계약\s?(?:연장|해지|만료|체결)|자유계약|FA\s?(?:선수|신분|영입)|방출|transfer|sign(?:s|ed|ing)\b|loan|contract (?:extension|renewal|termination)/i;
  const retrospective = /이적\s?당시|회상|재조명|되돌아|돌이켜|이적료.*(?:역대|순위|위엄)|역대.*이적료|이적생.*(?:가성비|평가)/i;
  const activeDeal = /영입\s?(?:확정|완료|발표)|이적\s?(?:확정|합의|임박|협상)|완전\s?이적|임대\s?이적|재계약\s?(?:체결|합의|발표)|계약\s?연장|이적설|영입설/i;
  const commercial = /스폰서|스폰서십|후원\s?계약|중계권|파트너십|공식\s?파트너|광고\s?계약|용품\s?계약|유니폼\s?계약/i;
  const staff = /감독|코치|사령탑|선임|경질/i;
  function classify(article) {
    const title = String(article.title || article.t || '').normalize('NFKC');
    const summary = String(article.summary || '').normalize('NFKC');
    // A player's friend/replacement is not necessarily a Korean player.
    const subject = title.replace(/[가-힣]{3}\s*(?:의\s*)?(?:절친|동료|대체자|후계자|후임)/g,'');
    const korean = players.test(subject);
    // "한국 축구 역대 최고 이적료" describes nationality, not a domestic competition.
    const domesticTitle = title.replace(/(?:한국|韓)\s?축구(?!\s?(?:대표팀|국가대표))/g,'');
    const f = foreignTopic.test(title);
    const d = domesticTopic.test(domesticTitle) || (!f && /(?:한국|韓)\s?축구/.test(title));
    // Publisher names and membership of a mixed sports feed are not topic evidence.
    const hint = String(article.category || article.tag || '');
    const domestic = d || (!f && (domesticTopic.test(summary) || /^(domestic|국내축구|K리그[12]?)$/.test(hint)));
    const intl = (!d && f) || (!domestic && (foreignTopic.test(summary) || /^(intl|해외축구|유럽축구|EPL)$/.test(hint)));
    const transfer = deal.test(title) && !commercial.test(title) && (!staff.test(title) || /선수.*(?:영입|이적|임대)/.test(title)) && (!retrospective.test(title) || activeDeal.test(title));
    return {korean, domestic, intl, transfer};
  }
  function select(articles, filter, limit = 4) {
    const rows = articles.map(article => ({...article, topics:classify(article)}));
    return rows.filter(n => filter === 'all' || n.topics[filter] === true).sort((a,b) =>
      (filter === 'all' ? Number(b.topics.korean)-Number(a.topics.korean) : 0) || b.d-a.d || a.title.localeCompare(b.title,'ko')
    ).slice(0,limit);
  }
  return {classify,select};
});
