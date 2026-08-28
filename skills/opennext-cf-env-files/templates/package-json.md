```json
{
  "scripts": {
    "check-env-vars": "IS_CF_WORKER=1 NEXT_PUBLIC_IS_CF_BUILD=1 bun -e 'await import(\"./src/env.server.ts\"); await import(\"./src/env.client.ts\"); console.log(\"env ok\")'"
  }
}
```
