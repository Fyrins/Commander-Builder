<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

class LogoutController extends AbstractController
{
    #[Route('/api/logout', name: 'api_logout', methods: ['POST'])]
    public function __invoke(): JsonResponse
    {
        $response = new JsonResponse(['success' => true]);

        $response->headers->setCookie(
            Cookie::create('auth_token')
                ->withValue('')
                ->withHttpOnly(true)
                ->withSecure(false)
                ->withSameSite('lax')
                ->withPath('/')
                ->withExpires(1)
        );

        return $response;
    }
}
