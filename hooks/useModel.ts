import { useEffect, useRef, useState } from "react";

const CLASSES = ["rock", "paper", "scissors"];

interface Layer {
  weights: number[][];
  biases: number[];
  batchNorm?: {
    gamma: number[];
    beta: number[];
    mean: number[];
    variance: number[];
  };
}

export function useModel() {
  const [ready, setReady] = useState(false);
  const layersRef = useRef<Layer[]>([]);

  useEffect(() => {
    fetch("/model_weights.json")
      .then((r) => r.json())
      .then((data) => {
        const w = data.weights;
        layersRef.current = [
          { weights: w[0][0], biases: w[0][1], batchNorm: { gamma: w[1][0], beta: w[1][1], mean: w[1][2], variance: w[1][3] } },
          { weights: w[3][0], biases: w[3][1], batchNorm: { gamma: w[4][0], beta: w[4][1], mean: w[4][2], variance: w[4][3] } },
          { weights: w[6][0], biases: w[6][1] },
          { weights: w[7][0], biases: w[7][1] },
        ];
        setReady(true);
        console.log("Modèle chargé !");
      });
  }, []);

  function relu(x: number[]): number[] {
    return x.map((v) => Math.max(0, v));
  }

  function softmax(x: number[]): number[] {
    const max = Math.max(...x);
    const exp = x.map((v) => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map((v) => v / sum);
  }

  function dense(input: number[], weights: number[][], biases: number[]): number[] {
    return biases.map((b, j) =>
      input.reduce((sum, x, i) => sum + x * weights[i][j], b)
    );
  }

  function batchNorm(x: number[], gamma: number[], beta: number[], mean: number[], variance: number[]): number[] {
    return x.map((v, i) => {
      const normalized = (v - mean[i]) / Math.sqrt(variance[i] + 1e-3);
      return gamma[i] * normalized + beta[i];
    });
  }

  function predict(landmarks: number[]): { gesture: string; confidence: number } {
    if (!ready || layersRef.current.length === 0) return { gesture: "rock", confidence: 0 };

    const [l0, l1, l2, l3] = layersRef.current;

    let x = landmarks;
    x = relu(batchNorm(dense(x, l0.weights, l0.biases), l0.batchNorm!.gamma, l0.batchNorm!.beta, l0.batchNorm!.mean, l0.batchNorm!.variance));
    x = relu(batchNorm(dense(x, l1.weights, l1.biases), l1.batchNorm!.gamma, l1.batchNorm!.beta, l1.batchNorm!.mean, l1.batchNorm!.variance));
    x = relu(dense(x, l2.weights, l2.biases));
    x = softmax(dense(x, l3.weights, l3.biases));

    const idx = x.indexOf(Math.max(...x));
    return { gesture: CLASSES[idx], confidence: x[idx] };
  }

  return { ready, predict };
}