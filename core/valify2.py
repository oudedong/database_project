# game/verify_full.py
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


# -----------------------------------------
# JS Rng 그대로 포팅
# -----------------------------------------
class Rng:
    """
    JS 코드의 Rng와 동일한 난수 생성기

    JS:

    class Rng {
        constructor(seed){
            this.a = (seed >>> 0);
        }
        random(){
            this.a = (this.a + 0x6D2B79F5) >>> 0;
            let t = this.a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }
    }
    """

    def __init__(self, seed: int) -> None:
        self.a = seed & 0xFFFFFFFF  # (seed >>> 0)

    def random(self) -> float:
        # this.a = (this.a + 0x6D2B79F5) >>> 0;
        self.a = (self.a + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.a

        # t = Math.imul(t ^ (t >>> 15), t | 1);
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF

        # t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF

        # return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296


# -----------------------------------------
# Node / Board 순수 시뮬레이터 (DOM, ON 상태 제거)
# -----------------------------------------


@dataclass
class NodeSim:
    value: Optional[int] = None
    parent: Optional["NodeSim"] = None
    children: List["NodeSim"] = field(default_factory=list)

    def is_empty(self) -> bool:
        return self.value is None

    def reset_node(self) -> None:
        """
        JS: Node_v2.reset_node()
        - value = undefined
        - status = EMPTY
        - parent = undefined
        - childs는 건드리지 않음 (JS도 리스트는 건드리지 않음)
        """
        self.value = None
        self.parent = None

    def append_child(self, child: "NodeSim") -> None:
        self.children.append(child)
        child.parent = self

    def merge_with_childs(self) -> Optional[Dict[str, int]]:
        """
        JS: Node_v2.merge_with_childs()를 거의 그대로 포팅.
        possibles: leaf children (children.length <= 0) 중 비어있지 않은 것들
        subset-sum으로 self.value(현재 값)를 만들 수 있는 leaf들의 조합을 찾고,
        찾으면 그 leaf들을 비우고, 자기 value를 두 배로 만들고, 부모로 재귀.
        """
        if self.is_empty():
            return None

        # leaf children만 후보
        possibles: List[NodeSim] = []
        for ch in self.children:
            if len(ch.children) == 0 and not ch.is_empty():
                possibles.append(ch)

        if not possibles:
            return None

        target_sum = self.value  # JS도 현재 value를 target으로 씀
        found_nodes: List[NodeSim] = []

        def dfs(cur_index: int, acc: int) -> bool:
            if acc == target_sum:
                return True
            if cur_index >= len(possibles):
                return False
            if acc > target_sum:
                return False  # 양수 값만 있다고 가정

            # 포함
            found_nodes.append(possibles[cur_index])
            if dfs(cur_index + 1, acc + possibles[cur_index].value):
                return True
            # 제외
            found_nodes.pop()
            if dfs(cur_index + 1, acc):
                return True
            return False

        ok = dfs(0, 0)
        if not ok:
            return None

        max_value = 0

        # 자기 값 두 배
        self.value *= 2
        if self.value > max_value:
            max_value = self.value

        # subset에 사용된 leaf들은 reset_node()
        for n in found_nodes:
            n.reset_node()

        # 비어 있는 child 제거
        new_children: List[NodeSim] = []
        for ch in self.children:
            if not ch.is_empty():
                new_children.append(ch)
        self.children = new_children

        result = {
            "max_value": max_value,
            "cnt_merge": len(found_nodes),
        }

        # 부모로 재귀
        if self.parent is not None:
            temp = self.parent.merge_with_childs()
            if temp is not None:
                result["max_value"] = max(result["max_value"], temp["max_value"])
                result["cnt_merge"] += temp["cnt_merge"]

        return result


class BoardSim:
    def __init__(self, size: int = 5) -> None:
        self.size = size
        self.grid: List[List[NodeSim]] = [
            [NodeSim() for _ in range(size)] for _ in range(size)
        ]

        # 초기 상태: (0,0)에 값 1 하나
        self.grid[0][0].value = 1
        self.max_value = 1
        self.cnt_empty = size * size - 1  # 전체칸 - 1

    def node(self, x: int, y: int) -> NodeSim:
        return self.grid[y][x]


# -----------------------------------------
# 전체 게임 시뮬레이터
# -----------------------------------------


class GameSimulator:
    """
    JS 쪽 Controller + Board의 핵심 로직을 서버에서 재현하는 클래스.
    - cur_value: 처음엔 1
    - 각 action을 순서대로 적용하면서 보드 상태, max_value, cnt_empty, RNG를 모두 맞춰 본다.
    """

    def __init__(self, seed: int, board_size: int = 5) -> None:
        self.board = BoardSim(board_size)
        self.rng = Rng(seed)
        self.cur_value = 1  # JS에서 처음 값은 1

    def _postprocess_after_click(self, clicked: NodeSim) -> None:
        """
        JS의 Board.clicked() 안에 있는 postprocess()와 동일한 역할.
        - clicked.childs.length > 0 이면, clicked.merge_with_childs()
        - 아니면, clicked.parent != undefined 이면 parent.merge_with_childs()
        - merge 결과에 따라 cnt_empty, max_value 갱신
        """
        merge_result = None
        if clicked.children:
            merge_result = clicked.merge_with_childs()
        elif clicked.parent is not None:
            merge_result = clicked.parent.merge_with_childs()

        if merge_result is not None:
            self.board.cnt_empty += merge_result["cnt_merge"]
            self.board.max_value = max(self.board.max_value, merge_result["max_value"])

    def step(self, action: Dict[str, Any]) -> None:
        """
        action 하나(한 라운드)를 적용.
        action 구조(JS this.data.actions에 push된 것):

        {
          "x_from": int,  # -1이면 same-value 클릭
          "y_from": int,
          "x_dest": int,
          "y_dest": int,
          "val": int,     # 그 턴의 cur_value
          "max_value": int  # JS에서 postprocess 후의 this.max_value (검증용)
        }
        """

        # 1. val == 현재 cur_value 인지 확인
        val = int(action["val"])
        if val != self.cur_value:
            raise ValueError(f"cur_value mismatch: expected {self.cur_value}, got {val}")

        x_from = int(action["x_from"])
        y_from = int(action["y_from"])
        x_dest = int(action["x_dest"])
        y_dest = int(action["y_dest"])
        reported_action_max = int(action["max_value"])

        size = self.board.size
        if not (0 <= x_dest < size and 0 <= y_dest < size):
            raise ValueError("x_dest/y_dest out of range")

        dest = self.board.node(x_dest, y_dest)

        # 2-1. same-value 더하기 (x_from == -1, y_from == -1)
        if x_from == -1 and y_from == -1:
            if dest.is_empty():
                raise ValueError("dest is empty in same-value action")
            if dest.value != self.cur_value:
                raise ValueError(
                    f"dest.value({dest.value}) != cur_value({self.cur_value})"
                )

            # JS: clicked_node.add_value(this.cur_value);
            dest.value += self.cur_value

            # JS: postprocess() -> merge_with_childs()
            self._postprocess_after_click(dest)

        # 2-2. 인접 칸에 새 값 두는 경우
        else:
            if not (0 <= x_from < size and 0 <= y_from < size):
                raise ValueError("x_from/y_from out of range")

            src = self.board.node(x_from, y_from)
            if src.is_empty():
                raise ValueError("x_from node is empty")

            # 인접한지 확인 (8방향)
            dx = x_dest - x_from
            dy = y_dest - y_from
            if dx == 0 and dy == 0:
                raise ValueError("x_from == x_dest && y_from == y_dest")
            if abs(dx) > 1 or abs(dy) > 1:
                raise ValueError("dest is not adjacent to from")

            if not dest.is_empty():
                raise ValueError("dest node is not empty for placement")

            # JS: this.cnt_empty -= 1; clicked_node.activate_node(this.cur_value);
            self.board.cnt_empty -= 1
            dest.value = self.cur_value

            # JS: last_clicked_node.append_child(clicked_node);
            src.append_child(dest)

            # JS: postprocess() 에서 dest 기준으로 merge
            self._postprocess_after_click(dest)

        # 3. JS에서 action.max_value와 동일해야 한다.
        if self.board.max_value != reported_action_max:
            raise ValueError(
                f"action.max_value mismatch: board={self.board.max_value}, "
                f"reported={reported_action_max}"
            )

        # 4. 다음 턴의 cur_value를 RNG로 갱신 (JS Controller.go_next_round와 동일)
        score = self.board.max_value
        rand = self.rng.random()
        base = score // 2  # Math.floor(score/2)
        # score가 1이면 base=0 -> Math.floor(rand * 0) + 1 = 1
        self.cur_value = int(rand * base) + 1

    def final_score(self) -> int:
        return self.board.max_value


# -----------------------------------------
# 최종 검증 함수 (Django view에서 이거만 호출하면 됨)
# -----------------------------------------


def verify_full_game_log(payload: Dict[str, Any], board_size: int = 5) -> bool:
    """
    클라이언트에서 온 전체 게임 로그를 '완전 검증'한다.

    payload 구조 (JS this.data):

    {
      "userId": ... (써도 되고 안 써도 되고),
      "score": int,           # 최종 스코어
      "time": int,
      "seed": int,
      "actions": [
        {
          "x_from": int,
          "y_from": int,
          "x_dest": int,
          "y_dest": int,
          "val": int,
          "max_value": int
        },
        ...
      ]
    }

    검증 내용:
    1) seed로 GameSimulator 생성 (초기 보드 (0,0)=1, cur_value=1)
    2) actions를 순서대로 적용하면서:
       - 각 턴의 val == cur_value
       - x_from, x_dest, 인접 여부, 빈칸 여부, same-value 여부 모두 규칙대로인지
       - merge 로직에 따라 board.max_value, cnt_empty 갱신
       - action.max_value == board.max_value 인지
       - RNG로 다음 cur_value가 잘 갱신되는지
    3) 마지막에 simulator.final_score() == payload["score"] 인지
    """

    # 필수 필드 체크
    for key in ("seed", "score", "actions"):
        if key not in payload:
            return False

    try:
        seed = int(payload["seed"])
        reported_final_score = int(payload["score"])
    except (TypeError, ValueError):
        return False

    actions = payload["actions"]
    if not isinstance(actions, list) or len(actions) == 0:
        return False

    # 너무 긴 로그는 거절 (선택)
    # if len(actions) > 10_000:
    #     return False

    sim = GameSimulator(seed, board_size=board_size)

    try:
        for action in actions:
            if not isinstance(action, dict):
                return False
            sim.step(action)
    except (KeyError, TypeError, ValueError):
        # 중간에 규칙 위반/형식 에러 발생 -> 부정행위/훼손된 로그로 간주
        return False

    # 최종 점수 일치해야 함
    if sim.final_score() != reported_final_score:
        return False

    return True
