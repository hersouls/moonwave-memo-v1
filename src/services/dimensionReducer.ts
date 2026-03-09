// ─── PCA-based 2D Projection ─────────────────────────
// Simple dimensionality reduction using power iteration for top 2 eigenvectors.

export function projectTo2D(vectors: number[][]): Array<{ x: number; y: number }> {
  if (vectors.length === 0) return []
  if (vectors.length === 1) return [{ x: 0, y: 0 }]

  const dim = vectors[0].length
  const n = vectors.length

  // 1. Center the data (subtract mean)
  const mean = new Float64Array(dim)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < dim; j++) {
      mean[j] += vectors[i][j]
    }
  }
  for (let j = 0; j < dim; j++) {
    mean[j] /= n
  }

  const centered: Float64Array[] = vectors.map((v) => {
    const c = new Float64Array(dim)
    for (let j = 0; j < dim; j++) {
      c[j] = v[j] - mean[j]
    }
    return c
  })

  // 2. Find top 2 principal components via power iteration
  const pc1 = powerIteration(centered, dim, n)
  // Deflate: remove pc1 component from data
  const deflated = deflateData(centered, pc1, n, dim)
  const pc2 = powerIteration(deflated, dim, n)

  // 3. Project each vector onto the 2 PCs
  const projected: Array<{ x: number; y: number }> = []
  for (let i = 0; i < n; i++) {
    let x = 0
    let y = 0
    for (let j = 0; j < dim; j++) {
      x += centered[i][j] * pc1[j]
      y += centered[i][j] * pc2[j]
    }
    projected.push({ x, y })
  }

  // 4. Normalize to [-1, 1] range
  let maxAbs = 0
  for (const p of projected) {
    maxAbs = Math.max(maxAbs, Math.abs(p.x), Math.abs(p.y))
  }

  if (maxAbs > 0) {
    for (const p of projected) {
      p.x /= maxAbs
      p.y /= maxAbs
    }
  }

  return projected
}

// Power iteration to find the dominant eigenvector of X^T X
function powerIteration(
  data: Float64Array[],
  dim: number,
  n: number,
  iterations = 20
): Float64Array {
  // Random initial vector
  const v = new Float64Array(dim)
  for (let j = 0; j < dim; j++) {
    v[j] = Math.random() - 0.5
  }
  normalize(v)

  const temp = new Float64Array(dim)

  for (let iter = 0; iter < iterations; iter++) {
    // Multiply: temp = X^T * (X * v)
    // First: w_i = dot(data[i], v) for each row
    // Then: temp[j] = sum_i(w_i * data[i][j])
    temp.fill(0)
    for (let i = 0; i < n; i++) {
      let dot = 0
      for (let j = 0; j < dim; j++) {
        dot += data[i][j] * v[j]
      }
      for (let j = 0; j < dim; j++) {
        temp[j] += dot * data[i][j]
      }
    }

    // Copy temp -> v and normalize
    for (let j = 0; j < dim; j++) {
      v[j] = temp[j]
    }
    normalize(v)
  }

  return v
}

function normalize(v: Float64Array): void {
  let norm = 0
  for (let j = 0; j < v.length; j++) {
    norm += v[j] * v[j]
  }
  norm = Math.sqrt(norm)
  if (norm > 0) {
    for (let j = 0; j < v.length; j++) {
      v[j] /= norm
    }
  }
}

function deflateData(
  data: Float64Array[],
  pc: Float64Array,
  _n: number,
  dim: number
): Float64Array[] {
  return data.map((row) => {
    let dot = 0
    for (let j = 0; j < dim; j++) {
      dot += row[j] * pc[j]
    }
    const deflated = new Float64Array(dim)
    for (let j = 0; j < dim; j++) {
      deflated[j] = row[j] - dot * pc[j]
    }
    return deflated
  })
}
