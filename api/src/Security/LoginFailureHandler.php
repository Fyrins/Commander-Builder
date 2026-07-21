<?php

namespace App\Security;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\TooManyLoginAttemptsAuthenticationException;
use Symfony\Component\Security\Http\Authentication\AuthenticationFailureHandlerInterface;

/**
 * Handler d'échec d'authentification : renvoie un 429 (Too Many Requests)
 * lorsque le login_throttling a bloqué l'IP/pseudonyme, un 401 sinon.
 * Sans lui, lexik mappe toutes les exceptions d'auth en 401 — le blocage
 * anti-brute-force fonctionne quand même, mais le front ne peut pas le
 * distinguer d'un simple mauvais mot de passe.
 */
class LoginFailureHandler implements AuthenticationFailureHandlerInterface
{
    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): Response
    {
        if ($exception instanceof TooManyLoginAttemptsAuthenticationException) {
            return new JsonResponse(
                ['error' => 'Trop de tentatives de connexion. Réessayez dans une minute.'],
                Response::HTTP_TOO_MANY_REQUESTS,
            );
        }

        return new JsonResponse(
            ['error' => 'Pseudonyme ou mot de passe incorrect.'],
            Response::HTTP_UNAUTHORIZED,
        );
    }
}
