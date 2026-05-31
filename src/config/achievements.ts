export interface Achievement {
  id: string;
  name: string;
  desc: string;
  condition: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { 
    id: 'firstKill', 
    name: '첫 번째 처치 (First Blood)', 
    desc: '미궁에서 첫 번째 적을 성공적으로 쓰러트렸습니다.', 
    condition: '적 1마리 처치' 
  },
  { 
    id: 'combo10', 
    name: '사신의 춤 (10 Combo)', 
    desc: '10 콤보를 달성하여 화려한 연격을 발동했습니다.', 
    condition: '10 콤보 달성' 
  },
  { 
    id: 'contamination100', 
    name: '독성 극복 (Toxic Survivor)', 
    desc: '오염도 100% 상태의 치명적인 상황에서 방을 완전히 정화했습니다.', 
    condition: '오염도 100% 상태에서 방 정화' 
  },
  { 
    id: 'allBuildsClear', 
    name: '전설의 개척자 (Labyrinth Master)', 
    desc: '모든 빌드(Breaker, Striker, Cartographer, Guardian)로 미궁을 각각 1회 이상 클리어했습니다.', 
    condition: '모든 빌드로 게임 클리어' 
  },
  { 
    id: 'expand10', 
    name: '무한한 팽창 (Infinity Expansion)', 
    desc: '한 번의 탐색에서 미궁의 방을 10회 이상 확장했습니다.', 
    condition: '방 10회 이상 확장' 
  },
  { 
    id: 'clearNoDeath', 
    name: '불멸의 생환 (Immortal Conqueror)', 
    desc: '사망 기록 없이 미궁의 최종 boss 구역을 돌파하고 생환했습니다.', 
    condition: '사망 없이 미궁 최종 클리어' 
  },
  {
    id: 'clearExtreme',
    name: '심연의 정복자 (Abyss Vanquisher)',
    desc: '가장 가혹한 환경인 심층(Extreme) 난이도를 돌파하고 생환에 성공했습니다.',
    condition: '심층 난이도로 게임 클리어'
  }
];
