import http from "k6/http";
import { check, group, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const PROFILE = __ENV.PROFILE || "smoke";
const INCLUDE_WRITES = (__ENV.INCLUDE_WRITES || "false").toLowerCase() === "true";

const profiles = {
  smoke: {
    vus: 1,
    duration: "30s",
    thresholds: {
      http_req_failed: ["rate<0.01"],
      http_req_duration: ["p(95)<700"],
    },
  },
  baseline: {
    stages: [
      { duration: "1m", target: 5 },
      { duration: "3m", target: 5 },
      { duration: "1m", target: 0 },
    ],
    thresholds: {
      http_req_failed: ["rate<0.01"],
      http_req_duration: ["p(95)<900"],
    },
  },
  stress: {
    stages: [
      { duration: "2m", target: 10 },
      { duration: "4m", target: 25 },
      { duration: "2m", target: 50 },
      { duration: "2m", target: 0 },
    ],
    thresholds: {
      http_req_failed: ["rate<0.02"],
      http_req_duration: ["p(95)<1500"],
    },
  },
  spike: {
    stages: [
      { duration: "30s", target: 5 },
      { duration: "30s", target: 60 },
      { duration: "1m", target: 60 },
      { duration: "30s", target: 5 },
      { duration: "30s", target: 0 },
    ],
    thresholds: {
      http_req_failed: ["rate<0.03"],
      http_req_duration: ["p(95)<2000"],
    },
  },
};

export const options = profiles[PROFILE] || profiles.smoke;

const jsonHeaders = {
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "trip-planner-k6-load-test/1.0",
  },
};

function expectJson(response, name) {
  return check(response, {
    [`${name}: status is 200`]: (res) => res.status === 200,
    [`${name}: response is json`]: (res) =>
      (res.headers["Content-Type"] || "").includes("application/json"),
  });
}

export default function () {
  group("health", () => {
    const response = http.get(`${BASE_URL}/`);
    check(response, {
      "health: status is 200": (res) => res.status === 200,
      "health: response is not empty": (res) => (res.body || "").length > 0,
    });
  });

  group("prompt stub", () => {
    const payload = JSON.stringify({
      prompt: "Plan a relaxed walking route in Sochi with lunch and a park stop.",
    });
    const response = http.post(`${BASE_URL}/prompt/`, payload, jsonHeaders);
    expectJson(response, "prompt");
    check(response, {
      "prompt: returns stub status": (res) => {
        try {
          return res.json("status") === "stub";
        } catch (error) {
          return false;
        }
      },
    });
  });

  group("partner recommendations", () => {
    const query = [
      "lat=43.5855",
      "lng=39.7203",
      "context_type=park",
      "budget_level=2",
      "day=1",
    ].join("&");
    const response = http.get(`${BASE_URL}/api/v1/partners/recommendations?${query}`);
    expectJson(response, "recommendations");
    check(response, {
      "recommendations: items array exists": (res) => {
        try {
          return Array.isArray(res.json("items"));
        } catch (error) {
          return false;
        }
      },
    });
  });

  if (INCLUDE_WRITES) {
    group("partner event write", () => {
      const payload = JSON.stringify({
        event_type: "impression",
        attribution_key: `k6-${__VU}-${__ITER}`,
        metadata: {
          load_test: true,
          profile: PROFILE,
        },
      });
      const response = http.post(`${BASE_URL}/api/v1/events/partner`, payload, jsonHeaders);
      check(response, {
        "event write: status is 201": (res) => res.status === 201,
      });
    });
  }

  sleep(Math.random() * 2 + 1);
}
