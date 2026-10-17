/* Moonwave UX — 진동
   규격: https://ux.moonwave.kr/patterns/app-shell#haptics */
import { getGestureSettings } from './gesture-settings'

/** 한 번 떨어요. 진동이 없는 기기(iOS Safari, 데스크톱)와, 설정의 손짓에서 진동을 끈 사람에게는 아무 일도 하지 않아요. */
export function haptic(pattern: number | number[] = 6) {
  if (!getGestureSettings().haptics) return
  try { navigator.vibrate?.(pattern) } catch { /* 막혀 있으면 조용히 넘어가요 */ }
}

let lastSelect = 0

/** 서비스가 함께 쓰는 진동 다섯 가지와 오류예요. 손이 한 일에 답할 때만 쓰고, 꾸밈으로 쓰지 않아요. */
export const haptics = {
  /** 값이 바뀌었어요 (칩, 탭, 사진 넘기기). 빠르게 훑을 때 이어서 떨지 않게 걸러요. */
  select() { const now = performance.now(); if (now - lastSelect > 60) { lastSelect = now; haptic(4) } },
  /** 가볍게 눌러 무언가 했어요 (하단 탭, 버튼). */
  tap() { haptic(6) },
  /** 손짓이 문턱을 넘었어요 (당겨서 새로 고침이 걸림, 길게 누르기가 받아들여짐). */
  impact() { haptic(12) },
  /** 손짓이 일을 마쳤어요 (새로 고쳤어요, 닫았어요). */
  success() { haptic([6, 40, 10]) },
  /** 끝에 닿았어요 (첫 사진 · 마지막 사진, 확대 한계). */
  edge() { haptic(3) },
  /** 받아들여지지 않았어요 (틀린 입력, 실패). 짧게 두 번이에요. */
  error() { haptic([10, 60, 10]) },
}
