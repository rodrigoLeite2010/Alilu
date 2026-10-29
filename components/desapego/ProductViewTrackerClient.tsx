"use client";
import { useEffect } from "react";
export function ProductViewTrackerClient({id}:{id:string}){useEffect(()=>{void fetch(`/api/desapego/${id}/view`,{method:"POST"}).catch(()=>{});},[id]);return null;}
