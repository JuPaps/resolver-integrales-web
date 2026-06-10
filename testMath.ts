import { solveIntegral, generatePlot } from './src/mathEngine';

console.log("---- PRUEBA x^2 INDEFINIDA ----");
const res1 = solveIntegral("x^2");
console.log(res1.success ? "SUCCESS" : "FAIL", res1.error);

console.log("---- PRUEBA x^2 DEFINIDA [0, 2] ----");
const res2 = solveIntegral("x^2", "0", "2");
console.log(res2.success ? "SUCCESS" : "FAIL", res2.error);

console.log("---- PRUEBA x^2 + 2x INDEFINIDA ----");
const res3 = solveIntegral("x^2 + 2*x");
console.log(res3.success ? "SUCCESS" : "FAIL", res3.error);

console.log("---- PRUEBA x^2 + 2x DEFINIDA [0, 2] ----");
const res4 = solveIntegral("x^2 + 2*x", "0", "2");
console.log(res4.success ? "SUCCESS" : "FAIL", res4.error);
