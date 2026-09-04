import { describe, expect, test } from "bun:test";
import { imageEditPromptHasExplicitGroups, parseImagePromptPlan, resolveImagePromptPlan } from "./imagePromptPlan";

const baseRequest = {
  prompt: "分别生成3张图\n图1，红色跑车\n图2，蓝色跑车\n图3，黑色跑车",
  imageCount: 3,
  taskType: "generation" as const,
  userId: "user_test",
  jobId: "job_test"
};

describe("image prompt plan parsing", () => {
  test("accepts a shared multi-image prompt", () => {
    expect(parseImagePromptPlan('{"mode":"shared","detectedGroupCount":0,"prompts":[]}', 3)).toEqual({
      version: 1,
      mode: "shared",
      requestedCount: 3,
      detectedGroupCount: 0,
      prompts: []
    });
  });

  test("accepts exactly numbered unique grouped prompts", () => {
    const plan = parseImagePromptPlan(JSON.stringify({
      mode: "grouped",
      detectedGroupCount: 3,
      prompts: [
        { index: 1, prompt: "红色跑车在山路上高速行驶" },
        { index: 2, prompt: "蓝色跑车停在现代展厅中" },
        { index: 3, prompt: "黑色跑车置于夜晚城市街道" }
      ]
    }), 3);

    expect(plan.mode).toBe("grouped");
    expect(plan.prompts).toEqual([
      "红色跑车在山路上高速行驶",
      "蓝色跑车停在现代展厅中",
      "黑色跑车置于夜晚城市街道"
    ]);
  });

  test("rejects missing, duplicate, and discontinuous groups", () => {
    expect(() => parseImagePromptPlan(JSON.stringify({
      mode: "grouped",
      prompts: [{ index: 1, prompt: "A" }, { index: 2, prompt: "B" }]
    }), 3)).toThrow("期望 3 组");
    expect(() => parseImagePromptPlan(JSON.stringify({
      mode: "grouped",
      prompts: [{ index: 1, prompt: "A" }, { index: 2, prompt: "A" }, { index: 3, prompt: "C" }]
    }), 3)).toThrow("不能重复");
    expect(() => parseImagePromptPlan(JSON.stringify({
      mode: "grouped",
      prompts: [{ index: 1, prompt: "A" }, { index: 3, prompt: "B" }, { index: 4, prompt: "C" }]
    }), 3)).toThrow("连续排列");
  });
});

describe("image prompt plan resolution", () => {
  test("keeps annotation edits shared despite numbered coordinate comments", async () => {
    let requestCount = 0;
    const plan = await resolveImagePromptPlan({
      prompt: "1. (x: 59.2%, y: 9.0%) 加一副眼镜\n再加一个光头强",
      imageCount: 2,
      taskType: "edit",
      editIntent: "annotation",
      userId: "user_test",
      jobId: "job_annotation"
    }, async () => {
      requestCount += 1;
      return JSON.stringify({ mode: "grouped", detectedGroupCount: 2, prompts: [
        { index: 1, prompt: "只加眼镜" },
        { index: 2, prompt: "只加光头强" }
      ] });
    });

    expect(plan.mode).toBe("shared");
    expect(plan.prompts).toEqual([]);
    expect(requestCount).toBe(0);
  });

  test("keeps ordinary multi-result edits shared unless images are explicitly labelled", async () => {
    let requestCount = 0;
    const plan = await resolveImagePromptPlan({
      prompt: "加一副眼镜，再加一个光头强",
      imageCount: 2,
      taskType: "edit",
      editIntent: "standard",
      userId: "user_test",
      jobId: "job_shared_edit"
    }, async () => {
      requestCount += 1;
      return "";
    });

    expect(plan.mode).toBe("shared");
    expect(requestCount).toBe(0);
  });

  test("allows explicitly labelled standard edits to use grouped prompts", async () => {
    const prompt = "图1：加一副眼镜\n图2：再加一个光头强";
    expect(imageEditPromptHasExplicitGroups(prompt, "standard")).toBe(true);
    expect(imageEditPromptHasExplicitGroups("图1：加眼镜，图2：加帽子", "standard")).toBe(true);
    expect(imageEditPromptHasExplicitGroups("Image 1: glasses, Image 2: hat", "standard")).toBe(true);
    expect(imageEditPromptHasExplicitGroups("1. 加一副眼镜\n2. 再加一个光头强", "standard")).toBe(false);
    expect(imageEditPromptHasExplicitGroups("1. (x: 10%, y: 20%) 加眼镜\n2. (x: 30%, y: 40%) 加帽子", "annotation")).toBe(false);

    const plan = await resolveImagePromptPlan({
      prompt,
      imageCount: 2,
      taskType: "edit",
      editIntent: "standard",
      userId: "user_test",
      jobId: "job_grouped_edit"
    }, async () => JSON.stringify({
      mode: "grouped",
      detectedGroupCount: 2,
      prompts: [
        { index: 1, prompt: "加一副眼镜" },
        { index: 2, prompt: "加一个光头强" }
      ]
    }));

    expect(plan.mode).toBe("grouped");
    expect(plan.prompts).toEqual(["加一副眼镜", "加一个光头强"]);
  });

  test("does not confuse numbered source-image roles with output groups", async () => {
    const prompt = "图1：保留产品主体\n图2：作为风格参考\n把产品改成蓝色";
    expect(imageEditPromptHasExplicitGroups(prompt, "standard", 2)).toBe(false);
    expect(imageEditPromptHasExplicitGroups("结果1：加眼镜，结果2：加帽子", "standard", 2)).toBe(true);
    expect(imageEditPromptHasExplicitGroups("Output 1: glasses, Output 2: hat", "standard", 2)).toBe(true);

    let requestCount = 0;
    const plan = await resolveImagePromptPlan({
      prompt,
      imageCount: 2,
      taskType: "edit",
      editIntent: "standard",
      sourceInputCount: 2,
      userId: "user_test",
      jobId: "job_reference_edit"
    }, async () => {
      requestCount += 1;
      return JSON.stringify({ mode: "grouped", detectedGroupCount: 2, prompts: [
        { index: 1, prompt: "只保留主体" },
        { index: 2, prompt: "只参考风格" }
      ] });
    });

    expect(plan.mode).toBe("shared");
    expect(requestCount).toBe(0);
  });

  test("repairs an invalid count once and uses the corrected grouped plan", async () => {
    const outputs = [
      JSON.stringify({ mode: "grouped", detectedGroupCount: 2, prompts: [{ index: 1, prompt: "A" }, { index: 2, prompt: "B" }] }),
      JSON.stringify({ mode: "grouped", detectedGroupCount: 2, prompts: [
        { index: 1, prompt: "A" },
        { index: 2, prompt: "B" },
        { index: 3, prompt: "C" }
      ] })
    ];
    const messages: string[][] = [];

    const plan = await resolveImagePromptPlan(baseRequest, async (requestMessages) => {
      messages.push(requestMessages.map((item) => item.content));
      return outputs.shift() ?? "";
    });

    expect(plan.mode).toBe("grouped");
    expect(plan.prompts).toEqual(["A", "B", "C"]);
    expect(messages).toHaveLength(2);
    expect(messages[1]?.at(-1)).toContain("期望 3 组");
  });

  test("falls back to the original shared request when the model fails", async () => {
    const plan = await resolveImagePromptPlan(baseRequest, async () => {
      throw new Error("model unavailable");
    });

    expect(plan.mode).toBe("fallback_shared");
    expect(plan.prompts).toEqual([]);
    expect(plan.fallbackReason).toContain("model unavailable");
  });
});
